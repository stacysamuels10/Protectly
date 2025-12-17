import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature, isTimestampValid } from '@/lib/webhook'
import { cancelCalendlyEvent, refreshAccessToken, type CalendlyWebhookPayload } from '@/lib/calendly'

export async function POST(request: NextRequest) {
  console.log('=== CALENDLY WEBHOOK RECEIVED ===')
  console.log('Timestamp:', new Date().toISOString())
  
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()
    console.log('Raw body length:', rawBody.length)
    
    const signatureHeader = request.headers.get('calendly-webhook-signature')
    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
    
    console.log('Has signature header:', !!signatureHeader)
    console.log('Has signing key:', !!webhookSigningKey)

    // Verify webhook signature
    if (webhookSigningKey) {
      if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSigningKey)) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✓ Signature verified')

      if (!isTimestampValid(signatureHeader)) {
        console.error('❌ Webhook timestamp outside tolerance')
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 })
      }
      console.log('✓ Timestamp valid')
    } else {
      console.log('⚠️ No signing key configured - skipping signature verification')
    }

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody)
    console.log('Event type:', payload.event)

    // Only process invitee.created events
    if (payload.event !== 'invitee.created') {
      console.log('Ignoring event type:', payload.event)
      return NextResponse.json({ received: true })
    }

    const { email: inviteeEmail, name: inviteeName } = payload.payload
    const eventUri = payload.payload.scheduled_event.uri
    const eventTypeUri = payload.payload.scheduled_event.event_type
    
    console.log('=== BOOKING DETAILS ===')
    console.log('Invitee email:', inviteeEmail)
    console.log('Invitee name:', inviteeName)
    console.log('Event URI:', eventUri)
    console.log('Event Type URI:', eventTypeUri)
    
    // Check if we've already processed this exact booking (deduplication)
    const existingAttempt = await prisma.bookingAttempt.findFirst({
      where: { calendlyEventUri: eventUri },
    })
    
    if (existingAttempt) {
      console.log('⚠️ Already processed this booking, skipping:', eventUri)
      return NextResponse.json({ received: true, status: 'already_processed' })
    }
    
    // Get the event host from event_memberships
    const eventHost = payload.payload.scheduled_event.event_memberships[0]?.user
    console.log('Event host URI:', eventHost)
    
    if (!eventHost) {
      console.error('❌ No event host found in webhook payload')
      return NextResponse.json({ received: true })
    }

    // Find the user by their Calendly URI
    const user = await prisma.user.findFirst({
      where: { calendlyUserUri: eventHost },
    })

    if (!user) {
      console.error('❌ User not found for webhook. Event host URI:', eventHost)
      return NextResponse.json({ received: true })
    }
    
    console.log('✓ Found user:', user.email)

    // Get the user's global allowlist with all entries
    const globalAllowlist = await prisma.allowlist.findFirst({
      where: {
        userId: user.id,
        isGlobal: true,
      },
      include: {
        entries: true,
      },
    })

    console.log('=== ALLOWLIST CHECK ===')
    console.log('Has global allowlist:', !!globalAllowlist)
    console.log('Total entries in allowlist:', globalAllowlist?.entries.length ?? 0)
    
    // Check if the invitee email is on the allowlist
    const normalizedInviteeEmail = inviteeEmail.toLowerCase().trim()
    const now = new Date()
    
    const matchingEntry = globalAllowlist?.entries.find((entry) => {
      const emailMatch = entry.email.toLowerCase().trim() === normalizedInviteeEmail
      const notExpired = entry.expiresAt === null || entry.expiresAt > now
      console.log(`  Checking entry: ${entry.email} - emailMatch: ${emailMatch}, notExpired: ${notExpired}`)
      return emailMatch && notExpired
    })

    const isApproved = !!matchingEntry
    console.log('Is approved:', isApproved)
    if (matchingEntry) {
      console.log('✓ Matched allowlist entry:', matchingEntry.email)
    } else {
      console.log('✗ No matching allowlist entry for:', normalizedInviteeEmail)
    }

    // Find or create the event type record
    let eventType = await prisma.eventType.findFirst({
      where: { calendlyEventTypeUri: eventTypeUri },
    })

    if (!eventType) {
      eventType = await prisma.eventType.create({
        data: {
          userId: user.id,
          calendlyEventTypeUri: eventTypeUri,
          name: payload.payload.scheduled_event.name,
          active: true,
        },
      })
      console.log('Created new event type record')
    }

    if (isApproved) {
      // Email IS on allowlist - allow the booking
      console.log('=== BOOKING APPROVED ===')
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: normalizedInviteeEmail,
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'APPROVED',
        },
      })

      console.log('✓ Booking approved and logged')
      return NextResponse.json({ received: true, status: 'approved' })
    }

    // Email is NOT on allowlist - cancel the booking
    console.log('=== CANCELLING BOOKING ===')
    console.log('Reason: Email not on allowlist')
    
    try {
      await cancelBookingWithRetry(user, eventUri)
      console.log('✓ Booking cancelled successfully')

      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: normalizedInviteeEmail,
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason: 'Email not on allowlist',
        },
      })

      console.log('✓ Rejection logged')
      return NextResponse.json({ received: true, status: 'rejected' })
    } catch (cancelError) {
      console.error('❌ Failed to cancel booking:', cancelError)
      
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: normalizedInviteeEmail,
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason: 'Email not on allowlist (cancellation may have failed)',
        },
      })

      return NextResponse.json({ received: true, status: 'rejected', error: 'cancellation_failed' })
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function cancelBookingWithRetry(
  user: { id: string; calendlyAccessToken: string | null; calendlyRefreshToken: string | null; cancelMessage: string },
  eventUri: string
) {
  console.log('Attempting to cancel booking...')
  console.log('User has access token:', !!user.calendlyAccessToken)
  console.log('User has refresh token:', !!user.calendlyRefreshToken)
  console.log('Cancel message:', user.cancelMessage)
  
  if (!user.calendlyAccessToken || !user.calendlyRefreshToken) {
    throw new Error('User not connected to Calendly')
  }

  try {
    console.log('Calling Calendly cancel API...')
    await cancelCalendlyEvent(user.calendlyAccessToken, eventUri, user.cancelMessage)
    console.log('✓ Cancel API call successful')
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown } }
    console.error('Cancel API error:', axiosError.response?.status, axiosError.response?.data)
    
    // If 401, try to refresh the token and retry
    if (axiosError.response?.status === 401) {
      console.log('Token expired, refreshing...')
      const newTokens = await refreshAccessToken(user.calendlyRefreshToken)
      
      // Update tokens in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          calendlyAccessToken: newTokens.access_token,
          calendlyRefreshToken: newTokens.refresh_token,
        },
      })
      console.log('✓ Token refreshed')

      // Retry with new token
      console.log('Retrying cancel with new token...')
      await cancelCalendlyEvent(newTokens.access_token, eventUri, user.cancelMessage)
      console.log('✓ Cancel successful after token refresh')
    } else {
      throw error
    }
  }
}


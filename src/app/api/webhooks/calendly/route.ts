import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature, isTimestampValid } from '@/lib/webhook'
import { cancelCalendlyEvent, refreshAccessToken, type CalendlyWebhookPayload } from '@/lib/calendly'

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()
    const signatureHeader = request.headers.get('calendly-webhook-signature')
    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY

    // Verify webhook signature
    if (webhookSigningKey) {
      if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSigningKey)) {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      if (!isTimestampValid(signatureHeader)) {
        console.error('Webhook timestamp outside tolerance')
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 })
      }
    }

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody)

    // Only process invitee.created events
    if (payload.event !== 'invitee.created') {
      return NextResponse.json({ received: true })
    }

    const { email: inviteeEmail, name: inviteeName } = payload.payload
    const eventUri = payload.payload.scheduled_event.uri  // The scheduled event URI - for cancellation
    const eventTypeUri = payload.payload.scheduled_event.event_type
    const inviteeUri = payload.payload.uri  // Unique identifier for this invitee/booking
    
    // Check if we've already processed this exact booking (deduplication)
    const existingAttempt = await prisma.bookingAttempt.findFirst({
      where: { calendlyEventUri: eventUri },
    })
    
    if (existingAttempt) {
      console.log('Already processed this booking, skipping:', eventUri)
      return NextResponse.json({ received: true, status: 'already_processed' })
    }
    
    // Get the event host from event_memberships (not created_by, which is who triggered the webhook)
    const eventHost = payload.payload.scheduled_event.event_memberships[0]?.user
    
    if (!eventHost) {
      console.error('No event host found in webhook payload')
      return NextResponse.json({ received: true })
    }

    // Find the user by their Calendly URI (the event host)
    const user = await prisma.user.findFirst({
      where: { calendlyUserUri: eventHost },
      include: {
        allowlists: {
          where: { isGlobal: true },
          include: {
            entries: {
              where: {
                email: inviteeEmail.toLowerCase(),
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
            },
          },
        },
      },
    })

    if (!user) {
      console.error('User not found for webhook. Event host URI:', eventHost)
      return NextResponse.json({ received: true })
    }

    // Check if the invitee is on the allowlist
    const globalAllowlist = user.allowlists[0]
    const isApproved = globalAllowlist?.entries.some(
      (entry) => entry.email.toLowerCase() === inviteeEmail.toLowerCase()
    )

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
    }

    if (isApproved) {
      // Log the approved booking
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: inviteeEmail.toLowerCase(),
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'APPROVED',
        },
      })

      return NextResponse.json({ received: true, status: 'approved' })
    }

    // Not on allowlist - cancel the booking
    try {
      await cancelBookingWithRetry(user, eventUri)

      // Log the rejected booking
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: inviteeEmail.toLowerCase(),
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason: 'Email not on allowlist',
        },
      })

      return NextResponse.json({ received: true, status: 'rejected' })
    } catch (cancelError) {
      console.error('Failed to cancel booking:', cancelError)
      
      // Still log the attempt even if cancellation failed
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: inviteeEmail.toLowerCase(),
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason: 'Email not on allowlist (cancellation may have failed)',
        },
      })

      return NextResponse.json({ received: true, status: 'rejected', error: 'cancellation_failed' })
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function cancelBookingWithRetry(
  user: { id: string; calendlyAccessToken: string | null; calendlyRefreshToken: string | null; cancelMessage: string },
  eventUri: string
) {
  if (!user.calendlyAccessToken || !user.calendlyRefreshToken) {
    throw new Error('User not connected to Calendly')
  }

  try {
    await cancelCalendlyEvent(user.calendlyAccessToken, eventUri, user.cancelMessage)
  } catch (error: any) {
    // If 401, try to refresh the token and retry
    if (error.response?.status === 401) {
      const newTokens = await refreshAccessToken(user.calendlyRefreshToken)
      
      // Update tokens in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          calendlyAccessToken: newTokens.access_token,
          calendlyRefreshToken: newTokens.refresh_token,
        },
      })

      // Retry with new token
      await cancelCalendlyEvent(newTokens.access_token, eventUri, user.cancelMessage)
    } else {
      throw error
    }
  }
}


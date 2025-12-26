import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature, isTimestampValid } from '@/lib/webhook'
import { cancelCalendlyEvent, refreshAccessToken, type CalendlyWebhookPayload } from '@/lib/calendly'

export async function POST(request: NextRequest) {
  console.log('[Calendly Webhook] Received webhook request')
  
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()
    const signatureHeader = request.headers.get('calendly-webhook-signature')
    const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY

    console.log('[Calendly Webhook] Signature header present:', !!signatureHeader)
    console.log('[Calendly Webhook] Signing key configured:', !!webhookSigningKey)

    // Verify webhook signature
    if (webhookSigningKey) {
      if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSigningKey)) {
        console.error('[Calendly Webhook] Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      if (!isTimestampValid(signatureHeader)) {
        console.error('[Calendly Webhook] Webhook timestamp outside tolerance')
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 })
      }
      console.log('[Calendly Webhook] Signature verified successfully')
    }

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody)
    console.log('[Calendly Webhook] Event type:', payload.event)

    // Only process invitee.created events
    if (payload.event !== 'invitee.created') {
      console.log('[Calendly Webhook] Ignoring non-invitee.created event')
      return NextResponse.json({ received: true })
    }

    const { email: inviteeEmail, name: inviteeName, uri: inviteeUri } = payload.payload
    const eventUri = payload.payload.scheduled_event.uri
    const eventTypeUri = payload.payload.scheduled_event.event_type
    const createdBy = payload.created_by

    console.log('[Calendly Webhook] Processing booking:', {
      inviteeEmail,
      inviteeName,
      inviteeUri,
      eventUri,
      createdBy,
    })

    // Extract guest emails from the booking
    const eventGuests = payload.payload.scheduled_event.event_guests || []
    const guestEmails = eventGuests.map(g => g.email.toLowerCase())

    console.log('[Calendly Webhook] Guest emails:', guestEmails)

    // Find the user by their Calendly URI
    // Fetch all valid allowlist entries (not filtered by email) so we can check guests too
    const user = await prisma.user.findFirst({
      where: { calendlyUserUri: createdBy },
      include: {
        allowlists: {
          where: { isGlobal: true },
          include: {
            entries: {
              where: {
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
      console.error('[Calendly Webhook] User not found for webhook:', createdBy)
      return NextResponse.json({ received: true })
    }

    console.log('[Calendly Webhook] Found user:', user.id)

    // Check allowlist entries
    const globalAllowlist = user.allowlists[0]
    const allowedEmails = new Set(
      (globalAllowlist?.entries || []).map(e => e.email.toLowerCase())
    )

    // Helper to check if an email is approved
    const isEmailApproved = (email: string) => allowedEmails.has(email.toLowerCase())

    // Check invitee and guests
    const inviteeApproved = isEmailApproved(inviteeEmail)
    const approvedGuests = guestEmails.filter(isEmailApproved)
    const unapprovedGuests = guestEmails.filter(email => !isEmailApproved(email))

    // Determine approval based on guest check mode
    let isApproved = false
    let rejectionReason = ''
    let cancelMessage = user.cancelMessage

    switch (user.guestCheckMode) {
      case 'ALLOW_ALL':
        // Allow all meetings (protection disabled)
        isApproved = true
        break

      case 'STRICT':
        // All participants (invitee + guests) must be approved
        isApproved = inviteeApproved && unapprovedGuests.length === 0
        if (!inviteeApproved) {
          rejectionReason = 'Email not on allowlist'
        } else if (unapprovedGuests.length > 0) {
          rejectionReason = `Unapproved guest(s): ${unapprovedGuests.join(', ')}`
          cancelMessage = user.guestCancelMessage
        }
        break

      case 'PRIMARY_ONLY':
        // Only check the scheduling invitee, guests are allowed regardless
        isApproved = inviteeApproved
        rejectionReason = 'Email not on allowlist'
        break

      case 'ANY_APPROVED':
        // Allow if any participant is approved
        isApproved = inviteeApproved || approvedGuests.length > 0
        rejectionReason = 'No participants on allowlist'
        break

      case 'NO_GUESTS':
        // Invitee must be approved AND no guests allowed at all
        if (!inviteeApproved) {
          isApproved = false
          rejectionReason = 'Email not on allowlist'
        } else if (guestEmails.length > 0) {
          isApproved = false
          rejectionReason = `Additional guests not allowed: ${guestEmails.join(', ')}`
          cancelMessage = user.guestCancelMessage
        } else {
          isApproved = true
        }
        break

      default:
        // Fallback to strict mode
        isApproved = inviteeApproved && unapprovedGuests.length === 0
        if (!inviteeApproved) {
          rejectionReason = 'Email not on allowlist'
        } else if (unapprovedGuests.length > 0) {
          rejectionReason = `Unapproved guest(s): ${unapprovedGuests.join(', ')}`
          cancelMessage = user.guestCancelMessage
        }
    }

    console.log('[Calendly Webhook] Allowlist check:', {
      hasGlobalAllowlist: !!globalAllowlist,
      totalEntriesCount: allowedEmails.size,
      guestCheckMode: user.guestCheckMode,
      inviteeApproved,
      guestCount: guestEmails.length,
      approvedGuestsCount: approvedGuests.length,
      unapprovedGuests,
      isApproved,
      rejectionReason: rejectionReason || null,
    })

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
      console.log('[Calendly Webhook] Booking APPROVED - email is on allowlist')
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

      console.log('[Calendly Webhook] Response: approved')
      return NextResponse.json({ received: true, status: 'approved' })
    }

    // Not on allowlist - cancel the booking
    // Note: To cancel, we must use the scheduled_event URI, not the invitee URI
    // The API endpoint is POST /scheduled_events/{event_uuid}/cancellation
    console.log('[Calendly Webhook] Booking NOT approved - attempting cancellation')
    console.log('[Calendly Webhook] Cancelling event URI:', eventUri)
    
    // Add a 4-second delay before cancellation to ensure the confirmation email
    // arrives in the invitee's inbox before the cancellation email
    console.log('[Calendly Webhook] Waiting 4 seconds before cancellation...')
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    try {
      await cancelBookingWithRetry(user, eventUri, cancelMessage)
      console.log('[Calendly Webhook] Cancellation successful')

      // Log the rejected booking
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: inviteeEmail.toLowerCase(),
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason,
        },
      })

      console.log('[Calendly Webhook] Response: rejected (cancelled successfully)')
      return NextResponse.json({ received: true, status: 'rejected' })
    } catch (cancelError: any) {
      console.error('[Calendly Webhook] Failed to cancel booking:', cancelError)
      console.error('[Calendly Webhook] Cancel error details:', {
        message: cancelError?.message,
        status: cancelError?.response?.status,
        data: cancelError?.response?.data,
      })
      
      // Still log the attempt even if cancellation failed
      await prisma.bookingAttempt.create({
        data: {
          userId: user.id,
          eventTypeId: eventType.id,
          inviteeEmail: inviteeEmail.toLowerCase(),
          inviteeName,
          calendlyEventUri: eventUri,
          status: 'REJECTED',
          rejectionReason: `${rejectionReason} (cancellation may have failed)`,
        },
      })

      console.log('[Calendly Webhook] Response: rejected (cancellation failed)')
      return NextResponse.json({ received: true, status: 'rejected', error: 'cancellation_failed' })
    }
  } catch (error: any) {
    console.error('[Calendly Webhook] Webhook processing error:', error)
    console.error('[Calendly Webhook] Error details:', {
      message: error?.message,
      stack: error?.stack,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Branding suffix that is always appended to cancellation messages
const PRICIAL_BRANDING = '\n\nPowered by PriCal'

async function cancelBookingWithRetry(
  user: { id: string; calendlyAccessToken: string | null; calendlyRefreshToken: string | null },
  eventUri: string,
  cancelMessage: string
) {
  if (!user.calendlyAccessToken || !user.calendlyRefreshToken) {
    throw new Error('User not connected to Calendly')
  }

  // Append branding to the cancel message
  const messageWithBranding = cancelMessage + PRICIAL_BRANDING

  try {
    await cancelCalendlyEvent(user.calendlyAccessToken, eventUri, messageWithBranding)
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
      await cancelCalendlyEvent(newTokens.access_token, eventUri, messageWithBranding)
    } else {
      throw error
    }
  }
}


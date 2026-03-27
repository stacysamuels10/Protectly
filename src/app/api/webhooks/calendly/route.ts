import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyWebhookSignature, isTimestampValid } from '@/lib/webhook'
import { cancelCalendlyEvent, refreshAccessToken, type CalendlyWebhookPayload } from '@/lib/calendly'
import { env } from '@/env'
import { encrypt, decrypt } from '@/lib/encryption'
import { evaluateGuestCheckMode } from '@/lib/guest-check'
import { logger } from '@/lib/logger'
import { getPostHogServer } from '@/lib/posthog-server'
import type { PostHog } from 'posthog-node'
import { sendEmail } from '@/lib/email'
import BookingApproved from '@/emails/booking-approved'
import BookingRejected from '@/emails/booking-rejected'

async function flushPostHog(ph: PostHog) {
  if (ph) await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
}

/**
 * @swagger
 * /api/webhooks/calendly:
 *   post:
 *     summary: Calendly webhook handler
 *     description: |
 *       Receives webhook events from Calendly when bookings are created.
 *       This endpoint verifies the webhook signature, checks if the invitee is on the allowlist,
 *       and automatically cancels unauthorized bookings.
 *
 *       **Note**: This endpoint is called by Calendly, not directly by clients.
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Calendly-Webhook-Signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook signature for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [invitee.created, invitee.canceled]
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: boolean
 *       401:
 *         description: Invalid webhook signature
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  logger.info('webhook request received')
  const ph = getPostHogServer() // may be null if NEXT_PUBLIC_POSTHOG_KEY is not set

  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()
    const signatureHeader = request.headers.get('calendly-webhook-signature')

    logger.info({ signaturePresent: !!signatureHeader }, 'webhook signature check')

    // Verify webhook signature — unconditional; no bypass path
    if (!verifyWebhookSignature(rawBody, signatureHeader, env.CALENDLY_WEBHOOK_SIGNING_KEY)) {
      logger.error('invalid webhook signature')
      await flushPostHog(ph)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (!isTimestampValid(signatureHeader)) {
      logger.error('webhook timestamp outside tolerance')
      await flushPostHog(ph)
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 })
    }
    logger.info('webhook signature verified')

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody)
    logger.info({ eventType: payload.event }, 'webhook event type')

    // Only process invitee.created events
    if (payload.event !== 'invitee.created') {
      logger.info({ eventType: payload.event }, 'ignoring non-invitee.created event')
      await flushPostHog(ph)
      return NextResponse.json({ received: true })
    }

    ph?.capture({ distinctId: 'system', event: 'webhook_received', properties: { source: 'calendly', eventType: payload.event } })

    // Idempotency check — use invitee URI as the dedup key (unique per invitee, not per event)
    const inviteeUri = payload.payload.uri
    try {
      await prisma.processedWebhookEvent.create({
        data: {
          idempotencyKey: inviteeUri,
          source: 'CALENDLY',
          eventType: payload.event,
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        logger.info({ inviteeUri }, 'duplicate event detected, skipping')
        await flushPostHog(ph)
        return NextResponse.json({ received: true, duplicate: true })
      }
      throw error
    }

    const { email: inviteeEmail, name: inviteeName } = payload.payload
    const eventUri = payload.payload.scheduled_event.uri
    const eventTypeUri = payload.payload.scheduled_event.event_type
    const createdBy = payload.created_by

    logger.info({ inviteeUri, eventUri, createdBy }, 'processing booking')

    // Extract guest emails from the booking
    const eventGuests = payload.payload.scheduled_event.event_guests || []
    const guestEmails = eventGuests.map(g => g.email.toLowerCase())

    logger.info({ guestCount: guestEmails.length }, 'guest emails extracted')

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
      logger.error({ createdBy }, 'user not found for webhook')
      await flushPostHog(ph)
      return NextResponse.json({ received: true })
    }

    logger.info({ userId: user.id }, 'user found')

    // Check allowlist entries
    const globalAllowlist = user.allowlists[0]
    const allowedEmailHashes = new Set(
      (globalAllowlist?.entries || []).map(e =>
        crypto.createHash('sha256').update(e.email.toLowerCase()).digest('hex')
      )
    )

    // Timing-safe email comparison: SHA-256 hash candidate, then timingSafeEqual against stored hashes
    function isEmailApproved(email: string): boolean {
      const candidateHashHex = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
      const candidateHash = Buffer.from(candidateHashHex, 'hex')
      for (const storedHashHex of allowedEmailHashes) {
        const storedHash = Buffer.from(storedHashHex, 'hex')
        try {
          if (crypto.timingSafeEqual(candidateHash, storedHash)) return true
        } catch {
          // Lengths should always match (both SHA-256 = 32 bytes) but handle defensively
        }
      }
      return false
    }

    // Check invitee and guests
    const inviteeApproved = isEmailApproved(inviteeEmail)
    const approvedGuests = guestEmails.filter(isEmailApproved)
    const unapprovedGuests = guestEmails.filter(email => !isEmailApproved(email))

    // Determine approval based on guest check mode
    const guestCheckResult = evaluateGuestCheckMode(
      user.guestCheckMode,
      inviteeApproved,
      approvedGuests,
      unapprovedGuests,
      guestEmails,
    )
    const { isApproved, rejectionReason } = guestCheckResult
    const cancelMessage = guestCheckResult.useGuestCancelMessage
      ? user.guestCancelMessage
      : user.cancelMessage

    logger.info({ userId: user.id, action: 'allowlist_check' }, 'checking allowlist')

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
      logger.info({ userId: user.id, action: 'booking_approved', eventUri }, 'booking approved')
      ph?.capture({ distinctId: user.id, event: 'booking_approved', properties: { source: 'calendly_webhook' } })
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

      // Send approved booking email (preference-gated, fire-and-forget)
      if (user.emailApprovedBookings) {
        try {
          const eventTime = new Date(payload.payload.scheduled_event.start_time).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          await sendEmail({
            to: user.email,
            subject: `Booking approved: ${inviteeName}`,
            react: BookingApproved({
              inviteeName,
              inviteeEmail,
              eventTypeName: payload.payload.scheduled_event.name,
              eventTime,
            }),
          })
          logger.info({ userId: user.id, action: 'email_sent', template: 'booking_approved' }, 'approved booking email sent')
        } catch (emailError) {
          logger.error({ err: emailError, userId: user.id, action: 'email_send_failed', template: 'booking_approved' }, 'failed to send approved booking email')
        }
      }

      logger.info({ action: 'booking_approved' }, 'response sent')
      await flushPostHog(ph)
      return NextResponse.json({ received: true, status: 'approved' })
    }

    // Not on allowlist - cancel the booking
    // Note: To cancel, we must use the scheduled_event URI, not the invitee URI
    // The API endpoint is POST /scheduled_events/{event_uuid}/cancellation
    logger.info({ userId: user.id, action: 'booking_rejected', eventUri }, 'booking rejected, attempting cancellation')
    ph?.capture({ distinctId: user.id, event: 'booking_rejected', properties: { source: 'calendly_webhook' } })
    logger.info({ eventUri, action: 'cancel_booking' }, 'cancelling event')

    // Add a 4-second delay before cancellation to ensure the confirmation email
    // arrives in the invitee's inbox before the cancellation email
    logger.info({ action: 'cancel_booking' }, 'waiting before cancellation')
    await new Promise(resolve => setTimeout(resolve, 4000))

    try {
      await cancelBookingWithRetry(user, eventUri, cancelMessage)
      logger.info({ action: 'cancel_booking' }, 'cancellation successful')

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

      // Send rejected booking email (preference-gated, fire-and-forget)
      if (user.emailRejectedBookings) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const addToAllowlistUrl = `${appUrl}/dashboard?add_email=${encodeURIComponent(inviteeEmail.toLowerCase())}`
          const eventTime = new Date(payload.payload.scheduled_event.start_time).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          await sendEmail({
            to: user.email,
            subject: `Booking cancelled: ${inviteeName}`,
            react: BookingRejected({
              inviteeName,
              inviteeEmail,
              eventTypeName: payload.payload.scheduled_event.name,
              eventTime,
              rejectionReason,
              addToAllowlistUrl,
            }),
          })
          logger.info({ userId: user.id, action: 'email_sent', template: 'booking_rejected' }, 'rejected booking email sent')
        } catch (emailError) {
          logger.error({ err: emailError, userId: user.id, action: 'email_send_failed', template: 'booking_rejected' }, 'failed to send rejected booking email')
        }
      }

      logger.info({ action: 'booking_rejected' }, 'response sent, cancellation successful')
      await flushPostHog(ph)
      return NextResponse.json({ received: true, status: 'rejected' })
    } catch (cancelError: any) {
      logger.error({ err: cancelError, action: 'cancel_booking' }, 'failed to cancel booking')
      ph?.capture({ distinctId: user.id, event: 'token_refresh_failed', properties: { source: 'calendly_webhook' } })

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

      // Send rejected booking email even if cancellation failed (preference-gated, fire-and-forget)
      if (user.emailRejectedBookings) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const addToAllowlistUrl = `${appUrl}/dashboard?add_email=${encodeURIComponent(inviteeEmail.toLowerCase())}`
          const eventTime = new Date(payload.payload.scheduled_event.start_time).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
          await sendEmail({
            to: user.email,
            subject: `Booking cancelled: ${inviteeName}`,
            react: BookingRejected({
              inviteeName,
              inviteeEmail,
              eventTypeName: payload.payload.scheduled_event.name,
              eventTime,
              rejectionReason,
              addToAllowlistUrl,
            }),
          })
          logger.info({ userId: user.id, action: 'email_sent', template: 'booking_rejected' }, 'rejected booking email sent (cancellation failed)')
        } catch (emailError) {
          logger.error({ err: emailError, userId: user.id, action: 'email_send_failed', template: 'booking_rejected' }, 'failed to send rejected booking email')
        }
      }

      logger.warn({ action: 'booking_rejected' }, 'response sent, cancellation failed')
      await flushPostHog(ph)
      return NextResponse.json({ received: true, status: 'rejected', error: 'cancellation_failed' })
    }
  } catch (error: any) {
    logger.error({ err: error, action: 'process_webhook' }, 'webhook processing failed')
    await flushPostHog(ph)
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

  // Decrypt tokens before use — convert crypto errors to a user-friendly message
  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decrypt(user.calendlyAccessToken)
    refreshToken = decrypt(user.calendlyRefreshToken!)
  } catch {
    throw new Error('User not connected to Calendly')
  }

  // Append branding to the cancel message
  const messageWithBranding = cancelMessage + PRICIAL_BRANDING

  try {
    await cancelCalendlyEvent(accessToken, eventUri, messageWithBranding)
  } catch (error: any) {
    // If 401, try to refresh the token and retry
    if (error.response?.status === 401) {
      const newTokens = await refreshAccessToken(refreshToken)

      // Encrypt new tokens before writing back to the database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          calendlyAccessToken: encrypt(newTokens.access_token),
          calendlyRefreshToken: encrypt(newTokens.refresh_token),
        },
      })

      // Retry with new plaintext token
      await cancelCalendlyEvent(newTokens.access_token, eventUri, messageWithBranding)
    } else {
      throw error
    }
  }
}

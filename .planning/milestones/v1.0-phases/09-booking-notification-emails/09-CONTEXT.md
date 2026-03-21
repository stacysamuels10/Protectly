# Phase 9: Booking Notification Emails - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Modify the Calendly webhook handler to send preference-gated emails when bookings are approved or rejected. Uses existing email infrastructure (Phase 8) and templates. No new UI, no new templates, no new API routes.

</domain>

<decisions>
## Implementation Decisions

### Inherited from Prior Phases
- **D-01 (Phase 8):** `sendEmail()` at `src/lib/email.ts` — Resend singleton, from "PriCal Notifications <notifications@prical.io>"
- **D-02 (Phase 8):** BookingApproved and BookingRejected templates exist at `src/emails/`
- **D-03 (Phase 8):** BookingRejected includes `rejectionReason` prop showing why the booking was rejected
- **D-04 (Phase 8):** User model has `emailApprovedBookings`, `emailRejectedBookings` boolean fields (default true)
- **D-05 (Phase 7):** Webhook handler has structured pino logging and PostHog event tracking already in place

### Claude's Discretion
- "Add to allowlist" link implementation (deep link to dashboard with prefilled email vs direct API endpoint)
- Which event details to include in the BookingApproved email (event type, date/time, invitee name)
- Error handling approach for email send failures (try/catch, log error, never block webhook response)
- Whether to query user preferences in the same database call as the existing user lookup or as a separate query
- Email subject lines for approved and rejected booking notifications

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Webhook handler (primary integration point)
- `src/app/api/webhooks/calendly/route.ts` — Existing webhook handler; email sends are added here
- `src/lib/email.ts` — sendEmail utility created in Phase 8
- `src/emails/booking-approved.tsx` — Template props interface
- `src/emails/booking-rejected.tsx` — Template props interface with rejectionReason

### Email preferences
- `prisma/schema.prisma` — User model with emailApprovedBookings/emailRejectedBookings fields
- `src/lib/session.ts` — getCurrentUser select includes email preference fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/email.ts` — `sendEmail({ to, subject, react })` ready to use
- `src/emails/booking-approved.tsx` — BookingApproved component with typed props
- `src/emails/booking-rejected.tsx` — BookingRejected component with rejectionReason
- `src/lib/logger.ts` — Structured logger for error logging on email failures
- `src/lib/posthog-server.ts` — PostHog tracking already in webhook handler

### Established Patterns
- Webhook handler already queries user from database (has user object with email)
- Email preference booleans are on User model — check before sending
- try/catch pattern for non-critical operations (email) that must not block webhook response
- PostHog `flushPostHog()` helper exists for serverless-safe event flushing

### Integration Points
- Calendly webhook handler POST function — add email sends after booking approve/reject logic
- User query in webhook handler — ensure it selects emailApprovedBookings/emailRejectedBookings
- Email send failures logged via pino logger but never thrown — webhook must return 200

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. All key decisions already made in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-booking-notification-emails*
*Context gathered: 2026-03-21*

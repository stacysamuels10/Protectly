---
phase: 09-booking-notification-emails
plan: 01
subsystem: api
tags: [email, resend, react-email, calendly, webhook, vitest, tdd]

# Dependency graph
requires:
  - phase: 08-email-infrastructure-preferences
    provides: sendEmail function, BookingApproved and BookingRejected templates, emailApprovedBookings/emailRejectedBookings user preferences
  - phase: 07-observability
    provides: pino logger used for email send success/failure logging

provides:
  - Preference-gated BookingApproved email sent after allowlist-approved bookings
  - Preference-gated BookingRejected email with one-click "Add to allowlist" deep link sent after rejections
  - Email failures silently caught and logged — webhook always returns 200
  - 6 new tests covering all email preference and failure scenarios

affects:
  - 10-trial-expiry (email pattern established: try/catch around sendEmail, logger.error on failure)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preference-gated email: check user.emailXxx boolean before calling sendEmail"
    - "Fire-and-forget email in webhook: await sendEmail inside try/catch, never re-throw"
    - "logger.error({ err: emailError }) for email failure visibility"
    - "addToAllowlistUrl: ${appUrl}/dashboard?add_email=${encodeURIComponent(email.toLowerCase())}"

key-files:
  created: []
  modified:
    - src/app/api/webhooks/calendly/route.ts
    - src/app/api/webhooks/calendly/route.test.ts

key-decisions:
  - "Email send is inside try/catch — email failures never block the 200 webhook response (per D-05 from Phase 8)"
  - "Rejected booking email also sent from cancellation-failure catch block — user notified even if Calendly API was unreachable"
  - "addToAllowlistUrl encodes email lowercase to prevent duplicate entries from case variants"

patterns-established:
  - "Pattern: TDD RED (failing tests committed) then GREEN (implementation) for webhook email integration"
  - "Pattern: Preference gate — if (user.emailXxx) { try { await sendEmail(...) } catch (e) { logger.error } }"

requirements-completed:
  - EMAIL-02
  - EMAIL-03

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 09 Plan 01: Booking Notification Emails Summary

**Preference-gated BookingApproved and BookingRejected emails added to Calendly webhook handler with try/catch isolation and one-click "Add to allowlist" deep link**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T20:46:29Z
- **Completed:** 2026-03-21T20:48:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added 6 new tests covering all email preference combinations and failure scenarios (TDD RED then GREEN)
- Webhook handler now sends BookingApproved email when `user.emailApprovedBookings` is true
- Webhook handler now sends BookingRejected email with deep link when `user.emailRejectedBookings` is true
- Email send failures are caught and logged via `logger.error` — webhook always returns 200
- Rejected booking email sent even when Calendly cancellation API call fails (booking still logged as REJECTED)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add email notification tests (RED phase)** - `e7cacaf` (test)
2. **Task 2: Add preference-gated email sends (GREEN phase)** - `707f30d` (feat)

_Note: TDD tasks have two commits (RED failing tests → GREEN implementation)_

## Files Created/Modified

- `src/app/api/webhooks/calendly/route.ts` - Added sendEmail/BookingApproved/BookingRejected imports, preference-gated email sends in approved path, rejected path (cancellation success), and rejected path (cancellation failure)
- `src/app/api/webhooks/calendly/route.test.ts` - Added vi.mock for @/lib/email, sendEmail mock variable, 6 tests in "booking notification emails" describe block

## Decisions Made

- Email send is inside try/catch — email failures never block the 200 webhook response (per D-05 from Phase 8)
- Rejected booking email also sent from the cancellation-failure catch block — user gets notified even if Calendly API was unreachable
- `addToAllowlistUrl` encodes invitee email lowercase to prevent duplicate allowlist entries from case variants

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in sentry.server.config.ts, env.ts, and logger.test.ts were present before this plan and are out of scope.

## User Setup Required

None - no external service configuration required for this plan. Resend domain DNS verification was a Phase 8 prerequisite.

## Next Phase Readiness

- Email notifications for approved and rejected bookings are complete
- Phase 10 (trial expiry warning emails) can follow the same pattern: sendEmail wrapped in try/catch with preference gate
- The `addToAllowlistUrl` pattern (`/dashboard?add_email=`) requires dashboard to handle the query param (may need Phase 10 or later)

---
*Phase: 09-booking-notification-emails*
*Completed: 2026-03-21*

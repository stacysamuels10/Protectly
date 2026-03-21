---
phase: 08-email-infrastructure-preferences
plan: 01
subsystem: infra
tags: [resend, react-email, email, transactional-email, vitest, tdd]

# Dependency graph
requires:
  - phase: 07-observability
    provides: server-only pattern, env.ts optional var pattern, vitest config with server-only alias

provides:
  - Resend singleton and sendEmail() utility at src/lib/email.ts
  - BaseLayout shared email wrapper component at src/emails/layout/base-layout.tsx
  - Five React Email templates: BookingApproved, BookingRejected, TrialExpiry3Days, TrialExpiry1Day, TrialExpired
  - RESEND_API_KEY and EMAIL_FROM as optional validated env vars in env.ts

affects: [09-booking-email-notifications, 10-trial-expiry]

# Tech tracking
tech-stack:
  added:
    - resend (Resend SDK for transactional email)
    - react-email (React-based email template authoring)
    - "@react-email/components (email-safe HTML primitives)"
    - "@react-email/render (server-side HTML rendering from React Email components)"
  patterns:
    - Resend singleton with server-only guard (same pattern as logger.ts, prisma.ts)
    - React Email templates as default-export components with typed props
    - BaseLayout wrapper for shared structure across all email templates
    - TDD red-green cycle for all new utilities and templates

key-files:
  created:
    - src/lib/email.ts
    - src/lib/email.test.ts
    - src/emails/layout/base-layout.tsx
    - src/emails/booking-approved.tsx
    - src/emails/booking-approved.test.tsx
    - src/emails/booking-rejected.tsx
    - src/emails/booking-rejected.test.tsx
    - src/emails/trial-expiry-3days.tsx
    - src/emails/trial-expiry-3days.test.tsx
    - src/emails/trial-expiry-1day.tsx
    - src/emails/trial-expiry-1day.test.tsx
    - src/emails/trial-expired.tsx
    - src/emails/trial-expired.test.tsx
  modified:
    - src/env.ts (RESEND_API_KEY and EMAIL_FROM optional vars added)
    - package.json (4 new packages added)

key-decisions:
  - "Resend mock uses class syntax (not vi.fn().mockImplementation) because Resend is instantiated with new — vitest requires a constructor-compatible mock"
  - "EMAIL_FROM and RESEND_API_KEY both optional in env.ts so app starts locally without Resend configured"
  - "sendEmail() does not catch errors — callers handle failures (webhook handlers in Phase 9 will wrap with try/catch)"
  - "From field uses env.EMAIL_FROM injected via env.ts, not hardcoded process.env"

patterns-established:
  - "Email singleton pattern: import 'server-only', construct Resend at module load, export sendEmail() utility"
  - "React Email template pattern: default export function with typed props, BaseLayout wrapper, @react-email/components primitives"
  - "Email test pattern: import { render } from '@react-email/render', await render(<Template {...props}/>), assert HTML contains prop values"

requirements-completed: [EMAIL-01]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 8 Plan 1: Email Infrastructure - Resend SDK and React Email Templates

**Resend singleton with sendEmail() utility and five React Email templates (BookingApproved, BookingRejected, TrialExpiry3Days, TrialExpiry1Day, TrialExpired) with 8 passing unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T20:21:23Z
- **Completed:** 2026-03-21T20:24:30Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Installed resend, react-email, @react-email/components, @react-email/render packages
- Created sendEmail() utility with proper error propagation (throws on Resend error, not silent failure)
- Built all five email templates with clean minimal style (D-01) and warm professional tone (D-02)
- BookingRejected includes rejectionReason prop per D-03 so users can see why a booking was cancelled
- 8 unit tests pass: 3 covering sendEmail() behavior, 5 covering template rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Install packages, add env vars, create sendEmail utility with tests** - `7433781` (feat)
2. **Task 2: Create BaseLayout and all five email templates with render tests** - `fe6dbf1` (feat)

**Plan metadata:** (to be added below)

## Files Created/Modified

- `src/lib/email.ts` - Resend singleton with server-only guard and sendEmail() export
- `src/lib/email.test.ts` - 3 unit tests: correct from field, error propagation, success case
- `src/emails/layout/base-layout.tsx` - Shared Html/Head/Body/Container wrapper with PriCal header and footer
- `src/emails/booking-approved.tsx` - Approved booking notification with inviteeName, inviteeEmail, eventTypeName
- `src/emails/booking-rejected.tsx` - Rejected booking notification with rejectionReason and Add to allowlist CTA
- `src/emails/trial-expiry-3days.tsx` - 3-day trial warning with Upgrade now CTA
- `src/emails/trial-expiry-1day.tsx` - 1-day trial warning with "expires tomorrow" copy
- `src/emails/trial-expired.tsx` - Trial expired notification with free plan downgrade message
- `src/env.ts` - Added RESEND_API_KEY and EMAIL_FROM as optional server env vars

## Decisions Made

- Used class mock syntax for Resend in vitest (`Resend: class { emails = { send: mockSend } }`) because `vi.fn().mockImplementation()` returns a function not usable as a constructor with `new`.
- EMAIL_FROM defaults to `notifications@prical.io` per D-07, but is validated via env.ts (optional) so the from address is configurable without code changes.
- sendEmail() does not wrap in try/catch per research pitfall 2 — callers (Phase 9 webhook handlers) will handle email failures gracefully without blocking the booking flow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Resend vi.mock to use class syntax instead of vi.fn().mockImplementation**
- **Found during:** Task 1 (sendEmail utility tests)
- **Issue:** `vi.mock('resend', () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }))` fails with "is not a constructor" because vitest wraps the factory return as a function, not a class
- **Fix:** Changed to `Resend: class { emails = { send: mockSend } }` which satisfies `new Resend()` call in email.ts
- **Files modified:** src/lib/email.test.ts
- **Verification:** All 3 tests pass after fix
- **Committed in:** 7433781 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in test mock pattern)
**Impact on plan:** Required to make tests work. No scope creep.

## Issues Encountered

- Resend mock pattern required class syntax rather than vi.fn() — documented above and in key-decisions for future test files.

## User Setup Required

None required for code validation. However per research Pitfall 1 (D-08):
- **Resend domain verification** for `prical.io` should be initiated in the Resend dashboard to allow real email delivery once Phase 9 wires templates to webhook handlers.
- During DNS propagation (24-48h), validate sends using Resend's test mode (`delivered@resend.dev`).

## Known Stubs

None — all templates render real content from props. No hardcoded placeholders.

## Next Phase Readiness

- sendEmail() utility ready for Phase 9 to import and call from webhook handlers
- All five templates ready with correct props — Phase 9 wires BookingApproved and BookingRejected; Phase 10 wires trial templates
- RESEND_API_KEY and EMAIL_FROM env vars documented and ready to add to Vercel/Railway

---
*Phase: 08-email-infrastructure-preferences*
*Completed: 2026-03-21*

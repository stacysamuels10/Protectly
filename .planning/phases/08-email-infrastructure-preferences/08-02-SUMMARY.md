---
phase: 08-email-infrastructure-preferences
plan: 02
subsystem: ui, api, database
tags: [prisma, radix-ui, react, next-api, zod, vitest]

# Dependency graph
requires:
  - phase: 08-01
    provides: Email infrastructure (src/lib/email.ts, React Email templates, Resend integration)
provides:
  - Three email notification preference booleans on User model (emailApprovedBookings, emailRejectedBookings, emailTrialWarnings)
  - GET/PATCH /api/settings/email-preferences API route with Zod validation
  - Switch UI component wrapping @radix-ui/react-switch
  - EmailPreferencesForm client component with three Switch toggles
  - Email Notifications settings card on settings page (after Guest Checking per D-05)
affects:
  - 09-booking-notifications (reads emailApprovedBookings, emailRejectedBookings before sending)
  - 10-trial-management (reads emailTrialWarnings before sending trial warning emails)

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-switch@2.1.8 — headless Switch primitive"
  patterns:
    - "PATCH partial-update semantics with Zod .refine() for empty-body rejection"
    - "Server component passes initial prefs as props; client form does optimistic state + PATCH on save"
    - "Switch component wraps Radix primitive with forwardRef + cn() classes"

key-files:
  created:
    - prisma/schema.prisma (modified — 3 boolean columns + @@index([trialEndsAt]))
    - src/components/ui/switch.tsx
    - src/app/api/settings/email-preferences/route.ts
    - src/app/api/settings/email-preferences/route.test.ts
    - src/components/dashboard/email-preferences-form.tsx
  modified:
    - src/lib/session.ts (getCurrentUser select includes 3 new fields)
    - src/app/(dashboard)/dashboard/settings/page.tsx (Email Notifications card inserted)

key-decisions:
  - "Used PATCH (not PUT) for email preferences — partial update semantics, consistent with research"
  - "Zod .refine() on empty object {} to return 400 with 'At least one field must be provided'"
  - "Used db push (not migrate dev) per Phase 4 decision — shadow database fails in Railway"
  - "getCurrentUser select updated to include 3 new boolean fields so server component can pass as props"

patterns-established:
  - "Preference toggle form: server component loads user, passes initialX props, client component owns state + PATCH on save"
  - "Switch component: Radix forwardRef wrapper, data-[state=checked/unchecked] Tailwind classes"

requirements-completed:
  - EMAIL-04

# Metrics
duration: 10min
completed: 2026-03-21
---

# Phase 08 Plan 02: Email Preferences Settings Summary

**Three email notification preference toggles with Switch UI component, Zod-validated PATCH API, and settings page card positioned after Guest Checking per D-05**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-21T15:25:00Z
- **Completed:** 2026-03-21T15:35:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Prisma schema updated with 3 boolean email preference columns (all default true) and @@index([trialEndsAt]) for Phase 10 cron efficiency
- GET/PATCH /api/settings/email-preferences API route with Zod validation rejects empty bodies and invalid types with 400
- Switch UI component created from @radix-ui/react-switch with forwardRef and Tailwind classes
- EmailPreferencesForm with three Switch toggles integrated into settings page after Guest Checking card
- 6 API tests pass, full 113-test suite green

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma migration, Switch component, API route with tests** - `3afb995` (feat)
2. **Task 2: Email preferences form and settings page integration** - `e830857` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `prisma/schema.prisma` — Added emailApprovedBookings, emailRejectedBookings, emailTrialWarnings booleans + @@index([trialEndsAt])
- `src/lib/session.ts` — getCurrentUser() select now includes 3 email preference fields
- `src/components/ui/switch.tsx` — Radix UI Switch wrapper with Tailwind styling
- `src/app/api/settings/email-preferences/route.ts` — GET + PATCH handlers with Zod validation
- `src/app/api/settings/email-preferences/route.test.ts` — 6 tests: GET 401/200, PATCH 401/200/400-empty/400-invalid
- `src/components/dashboard/email-preferences-form.tsx` — Client component with 3 Switch toggles and PATCH on save
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Email Notifications card inserted after Guest Checking

## Decisions Made
- Used PATCH (not PUT) for partial-update semantics per research decision D-04
- Zod .refine() on the empty object case to ensure "At least one field must be provided" error message
- Used `npx prisma db push` not `prisma migrate dev` — shadow database fails on Railway (Phase 4 decision)
- Updated getCurrentUser() select to include the 3 new fields so the server component can pass them as initial props to the client form

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated getCurrentUser() select to include email preference fields**
- **Found during:** Task 1 review (before writing form)
- **Issue:** session.ts getCurrentUser() uses an explicit select — new fields aren't returned unless added
- **Fix:** Added emailApprovedBookings, emailRejectedBookings, emailTrialWarnings to the select block
- **Files modified:** src/lib/session.ts
- **Verification:** Settings page can access user.emailApprovedBookings as props
- **Committed in:** 3afb995 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for correctness — without this fix the settings page would have TypeScript errors accessing undefined fields. No scope creep.

## Issues Encountered
- DATABASE_URL not in shell environment; used inline env var pass to `npx prisma db push`. Schema applied successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Email preference fields available on User model, API route live
- Phase 9 (booking notifications) can read emailApprovedBookings and emailRejectedBookings before sending
- Phase 10 (trial management) can read emailTrialWarnings before sending trial warning emails
- @@index([trialEndsAt]) ready for Phase 10 cron query

---
*Phase: 08-email-infrastructure-preferences*
*Completed: 2026-03-21*

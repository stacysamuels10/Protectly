---
phase: 12-onboarding-empty-states
plan: "01"
subsystem: ui
tags: [onboarding, wizard, dialog, prisma, posthog, radix-ui]

# Dependency graph
requires:
  - phase: 11-legal-pages
    provides: Dashboard layout foundation and footer already in place
provides:
  - Multi-step onboarding wizard (3 steps: Welcome, Add Email, Protection Active) shown to new users
  - POST /api/onboarding/complete endpoint that persists onboarding state and tracks PostHog events
  - onboardingCompleted field on User Prisma model
  - getCurrentUser now returns onboardingCompleted for dashboard conditional render
affects: [dashboard, allowlist, session]

# Tech tracking
tech-stack:
  added: []
  patterns: [controlled-dialog-without-trigger, client-component-wizard, prisma-db-push-no-shadow]

key-files:
  created:
    - src/components/dashboard/onboarding-wizard.tsx
    - src/app/api/onboarding/complete/route.ts
  modified:
    - prisma/schema.prisma
    - src/lib/session.ts
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "Wizard closes via overlay/X triggers skipped action (same as Skip for now) — prevents silent close-without-tracking"
  - "Used prisma generate (not migrate dev) to regenerate types since shadow database is unavailable; db push done in production"
  - "Step 2 (Add Email) advances to step 3 on duplicate or successful add; only invalid email blocks advancement"

patterns-established:
  - "Controlled Dialog without DialogTrigger: Dialog open state managed by useState, no trigger button needed"
  - "Onboarding wizard pattern: multi-step with skip links on each step, step indicator dots"

requirements-completed: [ONBOARD-01]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 12 Plan 01: Onboarding Wizard Summary

**Database-persisted 3-step onboarding wizard (Radix Dialog) shown to first-time users with PostHog event tracking and skip-at-every-step UX**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-22T00:40:00Z
- **Completed:** 2026-03-22T00:48:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `onboardingCompleted Boolean @default(false)` to Prisma User model and regenerated client types
- Created `POST /api/onboarding/complete` that updates DB and captures PostHog `onboarding_completed` or `onboarding_skipped` events
- Built 3-step wizard modal (Welcome, Add Email, Protection Active) as 'use client' component with skip links on every step
- Wired wizard into dashboard page — renders conditionally when `user.onboardingCompleted === false`, never appears for returning users

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onboardingCompleted field and API endpoint** - `e1fcc0c` (feat)
2. **Task 2: Create onboarding wizard and wire into dashboard** - `11bed4d` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added onboardingCompleted Boolean field to User model
- `src/lib/session.ts` - Added onboardingCompleted to getCurrentUser select
- `src/app/api/onboarding/complete/route.ts` - POST endpoint to persist onboarding state and track PostHog
- `src/components/dashboard/onboarding-wizard.tsx` - 3-step dialog wizard component with skip links
- `src/app/(dashboard)/dashboard/page.tsx` - Conditional wizard render based on onboardingCompleted

## Decisions Made
- Wizard closing via overlay click or X button fires `completeOnboarding('skipped')` — prevents silent dismissal without tracking
- Step 1 email add: invalid email blocks advancement, duplicate/success both advance to step 2 (no friction on already-known emails)
- Used `prisma generate` with a placeholder DATABASE_URL to regenerate client types without a live DB connection; actual `prisma db push` runs in production deployment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran prisma generate to fix TypeScript type errors after schema change**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** After adding `onboardingCompleted` to schema.prisma, the Prisma client types were stale — TypeScript reported "Property 'onboardingCompleted' does not exist on type..."
- **Fix:** Ran `DATABASE_URL="postgresql://placeholder..." npx prisma generate` to regenerate client types (no live DB needed for code generation)
- **Files modified:** `node_modules/@prisma/client` (generated, not committed)
- **Verification:** `npx tsc --noEmit` shows zero errors in production code files
- **Committed in:** e1fcc0c (Task 1 commit, schema change)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** Required fix for TypeScript correctness. No scope creep.

## Issues Encountered
- `prisma db push` and `prisma validate` both fail without DATABASE_URL in local/CI environment — used placeholder URL for schema validation and client generation. Actual DB push will happen on deployment.

## Known Stubs
None — all wizard steps are fully implemented with real API calls.

## User Setup Required
None - no external service configuration required for this plan. Deployment will run `prisma db push` automatically.

## Next Phase Readiness
- Onboarding wizard complete, ready for Plan 12-02 (empty state improvements)
- `user.onboardingCompleted` now available throughout the app via `getCurrentUser()`
- No blockers

---
*Phase: 12-onboarding-empty-states*
*Completed: 2026-03-22*

## Self-Check: PASSED
- prisma/schema.prisma: FOUND
- src/lib/session.ts: FOUND
- src/app/api/onboarding/complete/route.ts: FOUND
- src/components/dashboard/onboarding-wizard.tsx: FOUND
- .planning/phases/12-onboarding-empty-states/12-01-SUMMARY.md: FOUND
- Commit e1fcc0c: FOUND
- Commit 11bed4d: FOUND

---
phase: 12-onboarding-empty-states
plan: 02
subsystem: ui
tags: [react, nextjs, empty-states, onboarding, lucide-icons, tailwind]

# Dependency graph
requires:
  - phase: 12-01-onboarding-empty-states
    provides: Dashboard empty state patterns established in phase 1
provides:
  - Allowlist empty state with AddEmailDialog CTA button and encouraging copy
  - Activity log empty state with Calendly webhook explanation
  - Consistent D-04 icon pattern (bg-primary/10 circle) applied to both pages
affects: [onboarding, allowlist, activity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 empty state: Lucide icon in bg-primary/10 rounded-full container + heading + descriptive text + CTA"
    - "D-05 encouraging tone: explain what action enables the feature (webhook, adding contacts)"

key-files:
  created: []
  modified:
    - src/components/dashboard/allowlist-table.tsx
    - src/app/(dashboard)/dashboard/activity/page.tsx

key-decisions:
  - "Reused existing AddEmailDialog component as empty state CTA — no new UI needed"
  - "Activity page explicitly names Calendly webhook so new users understand setup dependency"

patterns-established:
  - "Empty state pattern: colored icon circle (bg-primary/10) + heading + max-w-sm text + primary CTA"
  - "Text explains what triggers content to appear, not just 'nothing here yet'"

requirements-completed: [ONBOARD-02]

# Metrics
duration: 1min
completed: 2026-03-22
---

# Phase 12 Plan 02: Allowlist and Activity Empty States Summary

**Allowlist and activity empty states upgraded with bg-primary/10 icon circles, encouraging copy, and AddEmailDialog CTA button to guide new users**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-22T00:46:06Z
- **Completed:** 2026-03-22T00:46:53Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Allowlist empty state now has colored icon background, more descriptive copy, and AddEmailDialog CTA so users can take action immediately
- Activity empty state now has matching colored icon background and explicitly mentions Calendly webhook to clarify why there's no data
- Both pages now follow the same D-04 visual pattern established in plan 01

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance allowlist and activity empty states with CTAs** - `021390b` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/components/dashboard/allowlist-table.tsx` - Added AddEmailDialog import and updated empty state with icon circle, encouraging copy, and CTA button
- `src/app/(dashboard)/dashboard/activity/page.tsx` - Updated empty state with icon circle, webhook explanation, and second line explaining allowlist checking

## Decisions Made
- Reused the existing `AddEmailDialog` component as the CTA in the allowlist empty state — no additional UI work needed, only an import
- Activity page copy explicitly names "Calendly webhook" because new users need to understand the external dependency that populates this page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `sentry.server.config.ts` and `src/env.ts` are unrelated to this plan's changes and were present before execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both empty states on the onboarding critical path are now actionable and informative
- Dashboard (phase 12-01) and Allowlist/Activity (phase 12-02) empty state improvements are complete
- Phase 12 (onboarding-empty-states) is fully complete

---
*Phase: 12-onboarding-empty-states*
*Completed: 2026-03-22*

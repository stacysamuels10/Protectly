---
phase: 18-activity-log-cross-feature
plan: 03
subsystem: ui
tags: [react, dropdown, allowlist, activity-log, toast]

# Dependency graph
requires:
  - phase: 18-01
    provides: ActivityLogClient component and allowlistId prop wired from server page
  - phase: 16-domain-api-webhook
    provides: POST /api/allowlists/[id]/entries and POST /api/allowlists/[id]/domains endpoints

provides:
  - AddToAllowlistButton dropdown component (email or domain add from activity log row)
  - Button wired into REJECTED rows only in ActivityLogClient

affects:
  - activity-log pages, allowlist pages, any future cross-feature UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DropdownMenu with onSelect handlers for async API actions
    - Optimistic "Added" disabled state after successful allowlist mutation
    - ResizeObserver class mock pattern for Radix UI / floating-ui in jsdom

key-files:
  created:
    - src/components/dashboard/add-to-allowlist-button.tsx
    - src/components/dashboard/add-to-allowlist-button.test.tsx
  modified:
    - src/components/dashboard/activity-log-client.tsx
    - src/components/dashboard/activity-log-client.test.tsx
    - src/test/setup.ts

key-decisions:
  - "ResizeObserver must be mocked as a class (not vi.fn()) for Radix UI DropdownMenu / floating-ui compatibility in jsdom"
  - "AddToAllowlistButton returns null when allowlistId is null — safe for users without an allowlist"
  - "Button transitions to disabled Added state on success (no re-add possible without page refresh)"

patterns-established:
  - "Dropdown action button pattern: DropdownMenu trigger + async handlers + success/error toast + disabled Added state"

requirements-completed: [XFEAT-01, XFEAT-02]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 18 Plan 03: Cross-Feature Add-to-Allowlist Button Summary

**AddToAllowlistButton dropdown lets users add a rejected invitee's email or domain to their allowlist directly from the activity log, with success/error toast feedback and disabled "Added" state**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T02:20:56Z
- **Completed:** 2026-03-28T02:25:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `AddToAllowlistButton` dropdown component with email/domain add options, loading state, success "Added" disabled state, and destructive error toast
- Fixed ResizeObserver mock in global test setup to use class syntax (required for Radix UI DropdownMenu in jsdom)
- Wired AddToAllowlistButton into ActivityLogClient REJECTED rows only, passing `allowlistId` and `email` props

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AddToAllowlistButton component with tests** - `339fb7f` (feat)
2. **Task 2: Wire AddToAllowlistButton into rejected activity rows** - `716ecb0` (feat, committed via 18-02 parallel agent picking up stash)

## Files Created/Modified

- `src/components/dashboard/add-to-allowlist-button.tsx` - Dropdown button POSTing to entries/domains APIs with loading, success, error states
- `src/components/dashboard/add-to-allowlist-button.test.tsx` - 9 tests covering all behaviors (dropdown open, email/domain POST, success state, error toast, loading, null allowlistId)
- `src/components/dashboard/activity-log-client.tsx` - Added AddToAllowlistButton import, activated `allowlistId` prop, conditionally renders button on REJECTED rows
- `src/components/dashboard/activity-log-client.test.tsx` - 3 wiring tests: button on REJECTED only, not on APPROVED, not on RATE_LIMITED
- `src/test/setup.ts` - Fixed ResizeObserver mock from vi.fn() to class syntax for floating-ui compatibility

## Decisions Made

- ResizeObserver mocked as class (not vi.fn()) — this is the established pattern from Phase 17, now applied to global setup
- AddToAllowlistButton returns null when allowlistId is null — users without an allowlist configured see no button
- On success, button transitions to disabled "Added" state — prevents duplicate add attempts without page refresh

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ResizeObserver mock in global test setup**
- **Found during:** Task 1 (TDD GREEN phase — tests failing)
- **Issue:** `global.ResizeObserver = vi.fn().mockImplementation(...)` is not a constructor; Radix UI / floating-ui calls `new ResizeObserver()` which throws "not a constructor"
- **Fix:** Replaced with `global.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} }`
- **Files modified:** src/test/setup.ts
- **Verification:** All 9 AddToAllowlistButton tests pass after fix
- **Committed in:** 339fb7f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix — without it, no DropdownMenu tests can run in jsdom. No scope creep.

## Issues Encountered

- Parallel agent 18-02 committed activity-log-client.tsx changes (including my Task 2 changes from a git stash pop) before Task 2 was individually committed. Task 2 changes are present in commit 716ecb0 (18-02 agent's commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AddToAllowlistButton is available for any other feature that needs quick allowlist additions from context (e.g., booking details modal)
- XFEAT-01 and XFEAT-02 requirements fulfilled

---
*Phase: 18-activity-log-cross-feature*
*Completed: 2026-03-28*

## Self-Check: PASSED

- src/components/dashboard/add-to-allowlist-button.tsx: FOUND
- src/components/dashboard/add-to-allowlist-button.test.tsx: FOUND
- .planning/phases/18-activity-log-cross-feature/18-03-SUMMARY.md: FOUND
- Commit 339fb7f: FOUND
- Commit 716ecb0: FOUND

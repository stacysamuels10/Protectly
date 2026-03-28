---
phase: 18-activity-log-cross-feature
plan: 02
subsystem: ui
tags: [react, next.js, debounce, search, activity-log, url-params]

# Dependency graph
requires:
  - phase: 18-activity-log-cross-feature
    provides: ActivityLogClient component with tabs, pagination, URL state management

provides:
  - Debounced email search input (300ms) wired to ?q= URL param in activity log
  - Rejection reason subtitle ("Reason: {text}") displayed on REJECTED rows only
  - Tests for search debounce, page reset, clear search, and rejection reason display

affects: [18-03-activity-log-cross-feature]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useRef for debounce timer cleanup (clearTimeout in handleSearchChange)
    - fireEvent.change + vi.useFakeTimers in try/finally for reliable debounce tests
    - mockSearchParams.current pattern for dynamic URL param control in tests

key-files:
  created: []
  modified:
    - src/components/dashboard/activity-log-client.tsx
    - src/components/dashboard/activity-log-client.test.tsx

key-decisions:
  - "fireEvent.change used for debounce tests instead of userEvent.type — avoids fake timer hangs from internal userEvent promise scheduling"
  - "vi.useFakeTimers in try/finally (no beforeEach/afterEach) to prevent timer leakage between tests"

patterns-established:
  - "Debounce pattern: useRef for timer + clearTimeout before new setTimeout"
  - "Rejection reason conditional: attempt.status === 'REJECTED' && attempt.rejectionReason"

requirements-completed: [ACTV-02, ACTV-04]

# Metrics
duration: 18min
completed: 2026-03-27
---

# Phase 18 Plan 02: Search and Rejection Reason Display Summary

**Debounced email search input (300ms, ?q= URL param) and rejection reason subtitles on REJECTED rows added to ActivityLogClient**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-27T21:21:00Z
- **Completed:** 2026-03-27T21:39:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Search input with Search icon, placeholder "Search by email...", aria-label for accessibility
- 300ms debounce via useRef/clearTimeout that updates ?q= and resets page to 1
- Rejection reason shown as "Reason: {text}" below event name, only for REJECTED status rows
- Approved and Rate Limited rows never show reason text
- 22 tests total passing (11 existing + 8 new search/rejection reason tests + 3 auto-added wiring tests)

## Task Commits

1. **Test RED: Search and rejection reason tests** - `ad5c469` (test)
2. **Task 1: Debounced search input and rejection reason display** - `716ecb0` (feat)

## Files Created/Modified
- `src/components/dashboard/activity-log-client.tsx` - Added Input import, debounce state/ref/handler, search input UI, rejection reason conditional
- `src/components/dashboard/activity-log-client.test.tsx` - Added describe('search') and describe('rejection reason') blocks, dynamic mockSearchParams

## Decisions Made
- Used `fireEvent.change` instead of `userEvent.type` for debounce tests — `userEvent.setup({ advanceTimers })` caused test timeouts due to internal promise scheduling conflicts with fake timers
- Used `vi.useFakeTimers()` in a `try/finally` block per-test instead of `beforeEach/afterEach` to prevent timer leakage when a test fails or times out
- Made `useSearchParams` mock dynamic via `mockSearchParams.current` object so individual tests can set initial URL state

## Deviations from Plan

### Auto-observed (not deviations — pre-existing linter changes)

The linter added `AddToAllowlistButton` import and usage to the component and additional `add to allowlist button wiring` tests to the test file. These were part of Plan 03's scope that got added by the auto-formatter. The tests for this button all pass correctly.

None of the plan's required functionality was blocked by this.

---

**Total deviations:** 0 plan deviations (1 linter auto-addition handled transparently)
**Impact on plan:** Plan executed as specified. Test strategy adapted for fake timer reliability.

## Issues Encountered
- `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` + `await user.type()` caused 5s timeout because userEvent's internal promise scheduling conflicts with fake timers. Resolved by switching to synchronous `fireEvent.change` + manual `vi.advanceTimersByTime(300)`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Search input and rejection reason display complete, all tests pass
- Plan 03 can proceed: AddToAllowlistButton wiring tests already exist and pass

## Self-Check: PASSED
- activity-log-client.tsx: FOUND
- activity-log-client.test.tsx: FOUND
- 18-02-SUMMARY.md: FOUND
- commit ad5c469: FOUND
- commit 716ecb0: FOUND

---
*Phase: 18-activity-log-cross-feature*
*Completed: 2026-03-27*

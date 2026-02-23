---
phase: 05-security-test-coverage
plan: 03
subsystem: testing
tags: [vitest, calendly, token-refresh, edge-cases, oauth]

# Dependency graph
requires:
  - phase: 02-token-security-webhook-hardening
    provides: calendlyRequest with encrypted token handling and 401 refresh logic
provides:
  - Token refresh failure propagation test for calendlyRequest
  - Retry-with-new-token verification test for calendlyRequest
  - Complete TST-05 coverage (5 tests total)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "axios.post spy for mocking refreshAccessToken failures"
    - "requestFn.mock.calls argument inspection for exact token verification"

key-files:
  created: []
  modified:
    - src/lib/calendly.test.ts

key-decisions:
  - "No new mock infrastructure needed -- reused existing vi.mock patterns for @/env, @/lib/encryption, ./prisma, and axios spy"

patterns-established:
  - "Refresh failure test: mock axios.post to reject, assert calendlyRequest rejects with same error"
  - "Token argument verification: use requestFn.mock.calls[N][0] for exact token value assertions across retry calls"

requirements-completed: [TST-05]

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 05 Plan 03: Calendly Token Refresh Edge Case Tests Summary

**Two additional calendlyRequest tests covering refresh failure propagation and retry-with-new-token verification, completing TST-05**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T02:17:27Z
- **Completed:** 2026-02-23T02:18:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added test verifying that when refreshAccessToken throws during 401 recovery, the error propagates cleanly (not swallowed or replaced with generic crash)
- Added test verifying the retry call after 401 refresh uses the NEW access token ('brand-new-token') rather than the old decrypted token ('old-access-token')
- calendly.test.ts now has 5 passing tests (3 existing + 2 new), fully satisfying TST-05
- Full suite of 60 tests passes with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add token refresh failure and retry-with-new-token tests** - `77227b2` (test)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/lib/calendly.test.ts` - Added 2 new test cases: refresh failure propagation and retry-uses-new-token verification

## Decisions Made
- No new mock infrastructure needed -- reused existing vi.mock patterns for @/env, @/lib/encryption, ./prisma, and axios spy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TST-05 fully satisfied with 5 calendly.test.ts tests covering all edge cases
- Phase 05 security test coverage plans complete (pending other plan summaries)

## Self-Check: PASSED

- FOUND: src/lib/calendly.test.ts
- FOUND: commit 77227b2
- FOUND: 05-03-SUMMARY.md

---
*Phase: 05-security-test-coverage*
*Completed: 2026-02-22*

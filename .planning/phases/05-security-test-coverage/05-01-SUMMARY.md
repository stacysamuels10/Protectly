---
phase: 05-security-test-coverage
plan: 01
subsystem: testing
tags: [vitest, webhook, hmac, guest-check, pure-function, security-tests]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: webhook signature verification functions (verifyWebhookSignature, isTimestampValid)
  - phase: 02-token-security-webhook-hardening
    provides: 60s timestamp tolerance, timing-safe email comparison
provides:
  - Webhook signature validation test suite (7 tests covering TST-01)
  - Extracted evaluateGuestCheckMode pure function in src/lib/guest-check.ts
  - Guest check mode test suite (15 tests covering TST-04)
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-extraction-for-testability, crypto-hmac-test-helper, vi.useFakeTimers-for-timestamp-boundaries]

key-files:
  created:
    - src/lib/webhook.test.ts
    - src/lib/guest-check.ts
    - src/lib/guest-check.test.ts
  modified:
    - src/app/api/webhooks/calendly/route.ts

key-decisions:
  - "evaluateGuestCheckMode accepts string mode (not typed GuestCheckMode enum) -- avoids Prisma import in pure module; enum values are string-compatible"
  - "Webhook test helper makeValidSignature mirrors production HMAC-SHA256 signing exactly -- tests verify our verification code, not Calendly's signing"
  - "All timestamp boundary tests use vi.useFakeTimers() with vi.setSystemTime() -- prevents flaky tests from wall-clock drift"

patterns-established:
  - "Pure function extraction: move complex switch/branching logic out of route handlers into importable pure functions for direct testing"
  - "Webhook signature test fixtures: use crypto.createHmac to generate valid signatures in tests rather than mocking the verification function"

requirements-completed: [TST-01, TST-04]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 5 Plan 01: Webhook Signature Tests & Guest Check Mode Extraction Summary

**Webhook HMAC-SHA256 signature validation tests (7 cases) and guest check mode pure function extraction with 15-case test suite covering all 5 modes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T02:17:22Z
- **Completed:** 2026-02-23T02:19:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created 7 webhook signature validation tests covering valid signature, wrong key, null header, tampered payload, 59s/61s timestamp boundaries, and null timestamp header (TST-01)
- Extracted guest check mode switch block from Calendly webhook handler into pure `evaluateGuestCheckMode` function in `src/lib/guest-check.ts`
- Created 15 guest check mode tests covering all 5 modes (ALLOW_ALL, STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS) x 3 scenarios each (TST-04)
- All 86 tests pass (22 new + 64 existing) across 10 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract guest check mode pure function and create webhook signature tests** - `d884129` (feat)
2. **Task 2: Create guest check mode test suite with 15 cases** - `6e15a81` (test)

## Files Created/Modified
- `src/lib/guest-check.ts` - Pure function evaluateGuestCheckMode extracted from webhook handler; exports GuestCheckResult interface
- `src/lib/webhook.test.ts` - 7 tests for verifyWebhookSignature and isTimestampValid (TST-01)
- `src/lib/guest-check.test.ts` - 15 tests for evaluateGuestCheckMode covering all 5 modes x 3 scenarios (TST-04)
- `src/app/api/webhooks/calendly/route.ts` - Replaced inline switch block with imported evaluateGuestCheckMode call

## Decisions Made
- Used `string` type for mode parameter in evaluateGuestCheckMode rather than importing Prisma's GuestCheckMode enum -- keeps the pure function free of Prisma dependency while remaining type-compatible
- All timestamp boundary tests freeze time with vi.useFakeTimers()/vi.setSystemTime() to prevent flaky wall-clock-drift failures
- Webhook test helper `makeValidSignature` mirrors production HMAC-SHA256 signing exactly, testing our verification code rather than mocking it away

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TST-01 and TST-04 are complete; ready for Plan 02 (Stripe lifecycle + allowlist ACL tests)
- The pure function extraction pattern established here can be referenced for any future extraction needs
- All 86 tests pass, providing a solid baseline for Plan 02 additions

## Self-Check: PASSED

All artifacts verified:
- src/lib/webhook.test.ts: FOUND
- src/lib/guest-check.ts: FOUND
- src/lib/guest-check.test.ts: FOUND
- 05-01-SUMMARY.md: FOUND
- Commit d884129: FOUND
- Commit 6e15a81: FOUND

---
*Phase: 05-security-test-coverage*
*Completed: 2026-02-22*

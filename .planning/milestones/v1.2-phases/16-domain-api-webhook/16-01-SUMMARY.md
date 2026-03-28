---
phase: 16-domain-api-webhook
plan: 01
subsystem: api
tags: [prisma, zod, posthog, vitest, domain-allowlisting]

# Dependency graph
requires:
  - phase: 15-domain-schema
    provides: DomainEntry model, ADD_DOMAIN/REMOVE_DOMAIN AuditAction enums, TIER_LIMITS.domainEntries
provides:
  - POST /api/allowlists/[id]/domains route with Zod validation, free provider blocking, tier limits, audit-first logging, PostHog tracking
  - DELETE /api/allowlists/[id]/domains/[domainId] route with audit-first REMOVE_DOMAIN logging
  - 18-test suite covering all validation paths, tier limits, duplicates, audit ordering, PostHog
affects: [17-domain-ui, 18-activity-log]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Domain normalization via trim().toLowerCase().replace(/^@/, '')
    - Free email provider blocking with Set<string> for O(1) lookup
    - Domain regex validation with RFC-compliant pattern
    - Audit-first pattern: auditLog.create before mutation

key-files:
  created:
    - src/app/api/allowlists/[id]/domains/route.ts
    - src/app/api/allowlists/[id]/domains/[domainId]/route.ts
    - src/app/api/allowlists/[id]/domains/domains.test.ts
  modified: []

key-decisions:
  - "Free email providers return 400 immediately (block entirely), not skip to invalid array"
  - "Shared mockCapture/mockShutdown pattern needed for PostHog test assertions vs per-call mocks"

patterns-established:
  - "Domain POST follows exact same structure as email entries POST (ownership, Zod, tier, loop, audit-first, PostHog)"
  - "Domain DELETE follows exact same structure as email entries DELETE (ownership, find, audit-first, delete)"
  - "TDD: test file written RED first, then routes written GREEN — all 18 pass"

requirements-completed: [DOM-04]

# Metrics
duration: 5min
completed: 2026-03-27
---

# Phase 16 Plan 01: Domain API Summary

**Domain CRUD API routes (POST + DELETE) with @ normalization, free provider blocking, tier limits, audit-first ADD_DOMAIN/REMOVE_DOMAIN logging, and PostHog tracking — 18 tests all passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-27T02:59:51Z
- **Completed:** 2026-03-27T03:04:26Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3 created

## Accomplishments

- POST /api/allowlists/[id]/domains handles validation, @ normalization, case normalization, free provider blocking (gmail.com etc.), tier limit enforcement, duplicate detection, audit-first ADD_DOMAIN logging, and PostHog add_domain event
- DELETE /api/allowlists/[id]/domains/[domainId] handles ownership check, domain entry lookup, audit-first REMOVE_DOMAIN logging, and deletion
- 18-test suite covering all behavior specs: Tests 1-14 for POST, Tests 15-18 for DELETE

## Task Commits

1. **Task 1: Create domain POST and DELETE route handlers** - `98f9d3f` (feat — TDD GREEN)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `src/app/api/allowlists/[id]/domains/route.ts` — Domain POST handler with FREE_EMAIL_PROVIDERS Set, domainRegex, normalizeDomain, validateDomain, Zod addDomainsSchema, tier limits, audit-first ADD_DOMAIN, PostHog add_domain
- `src/app/api/allowlists/[id]/domains/[domainId]/route.ts` — Domain DELETE handler with ownership check, audit-first REMOVE_DOMAIN, domainEntry.delete
- `src/app/api/allowlists/[id]/domains/domains.test.ts` — 18 tests: unauthenticated (401), missing allowlist (404), invalid body (400), valid add, @ normalization, uppercase normalization, free provider block (400), invalid format in invalid array, duplicate in duplicates array, tier limit (403), audit ordering, PostHog capture, DELETE unauthenticated/missing/valid

## Decisions Made

- Free email providers blocked with immediate 400 return (not skipped into invalid array) — consistent with D-03 intent: "block entirely"
- PostHog mock uses shared `mockCapture`/`mockShutdown` variables declared at module level so test and route reference the same function instances

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PostHog test mock to use shared capture instance**
- **Found during:** Task 1, Test 14 (PostHog)
- **Issue:** Test used `vi.fn(() => ({ capture: vi.fn() }))` — each call to getPostHogServer() returns a new object, so the route's capture call and the test's check reference different vi.fn() instances (0 calls observed)
- **Fix:** Extracted `mockCapture` and `mockShutdown` as module-level `vi.fn()` variables; mock factory returns same instances; test asserts on `mockCapture` directly
- **Files modified:** src/app/api/allowlists/[id]/domains/domains.test.ts
- **Verification:** Test 14 passes
- **Committed in:** 98f9d3f (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test mock setup)
**Impact on plan:** Necessary for correct test behavior. No scope creep.

## Issues Encountered

None beyond the mock fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Domain POST and DELETE routes fully implemented and tested — ready for Phase 17 UI to wire add/remove domain buttons
- Phase 16 Plan 02 (webhook domain matching) can now query domain entries that exist in the DB
- Pre-existing test failures in posthog-server.test.ts and calendly.test.ts are unrelated to this plan (confirmed present before changes)

## Self-Check: PASSED

All created files exist. Commit 98f9d3f verified in git history.

---
*Phase: 16-domain-api-webhook*
*Completed: 2026-03-27*

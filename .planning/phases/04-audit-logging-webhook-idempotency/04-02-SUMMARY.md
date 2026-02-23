---
phase: 04-audit-logging-webhook-idempotency
plan: 02
subsystem: api, webhooks
tags: [idempotency, webhook, prisma, P2002, calendly, stripe, deduplication]

# Dependency graph
requires:
  - phase: 04-audit-logging-webhook-idempotency
    plan: 01
    provides: ProcessedWebhookEvent model with unique idempotencyKey constraint
provides:
  - Calendly webhook idempotency guard (invitee URI dedup key)
  - Stripe webhook idempotency guard (event.id dedup key)
  - Typed env usage in Stripe webhook handler
affects: [webhook-reliability, subscription-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [insert-or-fail-P2002-idempotency, typed-env-over-process-env]

key-files:
  created: []
  modified:
    - src/app/api/webhooks/calendly/route.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/app/api/webhooks/calendly/route.test.ts

key-decisions:
  - "Calendly dedup key is invitee URI (not scheduled_event URI) -- unique per invitee even in group events"
  - "Stripe dedup key is event.id -- standard Stripe idempotency pattern"
  - "Both handlers use INSERT-or-fail via P2002 catch (not check-then-act) for race-safe deduplication"
  - "Stripe handler migrated from process.env.STRIPE_WEBHOOK_SECRET! to typed env.STRIPE_WEBHOOK_SECRET"

patterns-established:
  - "Insert-or-fail idempotency: attempt INSERT into ProcessedWebhookEvent, catch P2002 unique violation as duplicate signal"
  - "Typed Prisma error handling: instanceof Prisma.PrismaClientKnownRequestError with error.code check"

requirements-completed: [WHK-02]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 04 Plan 02: Webhook Idempotency Summary

**Race-safe idempotency guards on Calendly (invitee URI) and Stripe (event.id) webhook handlers using ProcessedWebhookEvent P2002 insert-or-fail pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T01:57:06Z
- **Completed:** 2026-02-23T01:59:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added idempotency guard to Calendly webhook handler using invitee URI as dedup key, positioned after signature verification but before any business logic
- Added idempotency guard to Stripe webhook handler using event.id as dedup key, positioned after constructEvent but before the switch block
- Replaced unsafe `process.env.STRIPE_WEBHOOK_SECRET!` with typed `env.STRIPE_WEBHOOK_SECRET` from `@/env`
- Updated Calendly test mock to include `processedWebhookEvent.create` -- all 52 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add idempotency guard to Calendly webhook handler** - `1c4760f` (feat)
2. **Task 2: Add idempotency guard to Stripe webhook handler and fix env usage** - `b4de78f` (feat)

## Files Created/Modified
- `src/app/api/webhooks/calendly/route.ts` - Added Prisma import, idempotency guard with P2002 catch after event type filter, extracted inviteeUri before destructuring
- `src/app/api/webhooks/stripe/route.ts` - Added Prisma and env imports, replaced process.env with typed env, added idempotency guard with P2002 catch after constructEvent
- `src/app/api/webhooks/calendly/route.test.ts` - Added processedWebhookEvent.create to prisma mock

## Decisions Made
- Calendly dedup key is `payload.payload.uri` (invitee URI) not the scheduled_event URI -- invitee URI is unique per invitee even in group events where multiple invitees share the same scheduled_event
- Stripe dedup key is `event.id` -- the standard Stripe webhook deduplication pattern, used after signature verification so the event.id is verified
- Both handlers use INSERT-or-fail (P2002 catch) rather than check-then-act -- race-safe because the unique constraint prevents concurrent duplicate inserts at the database level
- Stripe handler migrated from `process.env.STRIPE_WEBHOOK_SECRET!` to `env.STRIPE_WEBHOOK_SECRET` -- removes unsafe non-null assertion, typed env guarantees string at startup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate inviteeUri variable declaration**
- **Found during:** Task 1
- **Issue:** The plan's idempotency guard introduces `const inviteeUri = payload.payload.uri` but the existing destructuring on the next line also declares `uri: inviteeUri`, causing a duplicate variable error
- **Fix:** Removed `uri: inviteeUri` from the destructuring since inviteeUri is now declared above; the variable remains available for all downstream uses
- **Files modified:** src/app/api/webhooks/calendly/route.ts
- **Verification:** TypeScript compiles, inviteeUri referenced in 3 places (dedup key, duplicate log, processing log)
- **Committed in:** 1c4760f (Task 1 commit)

**2. [Rule 3 - Blocking] Added processedWebhookEvent mock to test file**
- **Found during:** Task 1
- **Issue:** Existing Calendly test mocks prisma but does not include processedWebhookEvent -- tests would fail when the handler calls prisma.processedWebhookEvent.create
- **Fix:** Added `processedWebhookEvent: { create: vi.fn() }` to the prisma mock object in route.test.ts
- **Files modified:** src/app/api/webhooks/calendly/route.test.ts
- **Verification:** All 52 tests pass including both Calendly webhook tests
- **Committed in:** 1c4760f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. The duplicate variable fix was an oversight in the plan; the mock update was required to maintain test compatibility.

## Issues Encountered
None -- both tasks executed cleanly after the two auto-fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both webhook handlers are now idempotent via ProcessedWebhookEvent table
- Phase 04 (Audit Logging & Webhook Idempotency) is fully complete
- Ready for Phase 05

## Self-Check: PASSED

- [x] 04-02-SUMMARY.md exists
- [x] calendly/route.ts exists
- [x] stripe/route.ts exists
- [x] Commit 1c4760f found
- [x] Commit b4de78f found

---
*Phase: 04-audit-logging-webhook-idempotency*
*Completed: 2026-02-22*

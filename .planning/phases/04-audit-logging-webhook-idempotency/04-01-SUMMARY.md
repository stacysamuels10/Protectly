---
phase: 04-audit-logging-webhook-idempotency
plan: 01
subsystem: database, api
tags: [prisma, audit-log, webhook-idempotency, postgres, write-audit-first]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Prisma schema with User, Allowlist, AllowlistEntry models
provides:
  - AuditLog model for immutable allowlist mutation tracking
  - ProcessedWebhookEvent model for webhook idempotency (Plan 02)
  - Write-audit-first pattern in POST and DELETE handlers
affects: [04-02-webhook-idempotency, audit-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [write-audit-first, append-only-audit-log, prisma-db-push]

key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/app/api/allowlists/[id]/entries/route.ts
    - src/app/api/allowlists/[id]/entries/[entryId]/route.ts

key-decisions:
  - "Used prisma db push instead of prisma migrate dev -- shadow database fails due to missing initial migration; db push syncs schema directly"
  - "AuditLog.userId is NOT a foreign key -- keeps audit log independent of user lifecycle (append-only immutability)"
  - "DELETE handler changed from deleteMany to delete since entry existence is verified before audit log creation"

patterns-established:
  - "Write-audit-first: audit record created BEFORE the mutation so it persists even if the mutation fails"
  - "Append-only model: AuditLog has no updatedAt field, enforcing immutability at schema level"

requirements-completed: [ACL-02]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 04 Plan 01: Audit Logging Summary

**AuditLog and ProcessedWebhookEvent Prisma models with write-audit-first logging in allowlist POST (ADD) and DELETE (REMOVE) handlers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T01:51:16Z
- **Completed:** 2026-02-23T01:54:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added AuditLog model (append-only, indexed on userId+createdAt and allowlistId) and ProcessedWebhookEvent model (unique idempotencyKey) to Prisma schema
- Instrumented POST handler with per-email AuditLog creation (action ADD) using write-audit-first pattern
- Instrumented DELETE handler with AuditLog creation (action REMOVE) after entry lookup, before deletion
- All 52 existing tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AuditLog and ProcessedWebhookEvent models to Prisma schema and run migration** - `5efe597` (feat)
2. **Task 2: Add audit logging to allowlist entry POST and DELETE handlers** - `f1cda73` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added AuditAction enum, WebhookSource enum, AuditLog model, ProcessedWebhookEvent model
- `src/app/api/allowlists/[id]/entries/route.ts` - Added prisma.auditLog.create with action ADD before allowlistEntry.create in email loop
- `src/app/api/allowlists/[id]/entries/[entryId]/route.ts` - Added entry lookup, prisma.auditLog.create with action REMOVE before allowlistEntry.delete

## Decisions Made
- Used `prisma db push` instead of `prisma migrate dev` because the shadow database fails on existing migrations that reference tables without an initial migration. `db push` directly syncs the schema to the database and regenerates the client.
- AuditLog.userId is intentionally NOT a foreign key relation to keep the audit log independent of user lifecycle -- if a user is deleted, their audit records persist.
- Changed DELETE handler from `deleteMany` to `delete` since entry existence is already verified by the preceding `findFirst` call (cleaner and consistent with the audit-first pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used prisma db push instead of prisma migrate dev**
- **Found during:** Task 1 (Schema migration)
- **Issue:** `prisma migrate dev` failed with P3006 error -- shadow database could not apply existing migration `20231221000000_add_guest_check_settings` because there is no initial migration creating the `users` table
- **Fix:** Used `prisma db push` which syncs the schema directly without requiring a shadow database, then verified tables exist via Prisma client queries
- **Files modified:** None (runtime command change only)
- **Verification:** `prisma validate` passes, `prisma.auditLog.count()` and `prisma.processedWebhookEvent.count()` both return 0 confirming tables exist
- **Committed in:** 5efe597 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for pre-existing migration history gap. No scope creep. Database schema is identical to what migrate dev would produce.

## Issues Encountered
- Pre-existing migration history gap: the migrations directory has two incremental migrations but no initial migration creating the base tables. This is a pre-existing condition unrelated to this plan. Logged as informational; not fixing it as it's out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AuditLog table is populated on every allowlist mutation (ADD/REMOVE)
- ProcessedWebhookEvent table is ready for Plan 02 (webhook idempotency)
- Write-audit-first pattern established for future handlers

## Self-Check: PASSED

- [x] 04-01-SUMMARY.md exists
- [x] prisma/schema.prisma exists
- [x] entries/route.ts exists
- [x] [entryId]/route.ts exists
- [x] Commit 5efe597 found
- [x] Commit f1cda73 found

---
*Phase: 04-audit-logging-webhook-idempotency*
*Completed: 2026-02-22*

---
phase: 15-domain-schema
plan: 01
subsystem: database
tags: [prisma, postgres, schema, migrations, tier-limits]

# Dependency graph
requires: []
provides:
  - DomainEntry Prisma model with allowlistId FK, domain field, unique constraint on [allowlistId, domain], and index on domain
  - AuditAction enum extended with ADD_DOMAIN and REMOVE_DOMAIN values
  - TIER_LIMITS.domainEntries: FREE=10, PRO=100, BUSINESS=500, ENTERPRISE=Infinity
  - Migration 20260326212838_add_domain_entry_model applied to database
affects:
  - phase-16-domain-api (CRUD endpoints use DomainEntry model and AuditAction enum)
  - phase-17-webhook-domain (webhook matching uses DomainEntry and domainEntries relation)
  - phase-18-domain-ui (UI enforces tier limits from TIER_LIMITS.domainEntries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DomainEntry mirrors AllowlistEntry pattern (separate model, not type discriminator) with only essential fields (no notes, expiresAt, addedById)
    - Tier limits colocated in TIER_LIMITS constant for all gated features

key-files:
  created:
    - prisma/migrations/20260326212838_add_domain_entry_model/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/utils.ts

key-decisions:
  - "DomainEntry as separate model (not AllowlistEntry reuse) — prevents CSV/audit/validation breakage"
  - "No optional fields on DomainEntry (no notes, expiresAt, addedById) — lean model per D-03"
  - "FREE tier gets 10 domain entries (not 0) to allow feature trial per D-07"
  - "Migration created manually via migrate diff + deploy due to shadow DB mismatch with existing migrations"

patterns-established:
  - "DomainEntry pattern: id, allowlistId, domain, createdAt, updatedAt — use for domain-only relation models"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 15 Plan 01: Domain Schema Summary

**DomainEntry Prisma model with domain allowlisting constraints, AuditAction enum extended with ADD_DOMAIN/REMOVE_DOMAIN, and TIER_LIMITS updated with domain entry quotas per tier**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T02:27:01Z
- **Completed:** 2026-03-27T02:30:18Z
- **Tasks:** 2
- **Files modified:** 2 (+ 1 migration created)

## Accomplishments
- DomainEntry model added to Prisma schema with allowlistId FK, domain VARCHAR(255), unique constraint on [allowlistId, domain], domain index for webhook lookup performance, and cascade delete
- Allowlist model updated with domainEntries DomainEntry[] relation
- AuditAction enum extended with ADD_DOMAIN and REMOVE_DOMAIN for audit trail support
- Migration 20260326212838_add_domain_entry_model applied cleanly to Railway PostgreSQL database
- TIER_LIMITS updated with domainEntries key: FREE=10, PRO=100, BUSINESS=500, ENTERPRISE=Infinity

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DomainEntry model and extend AuditAction enum** - `4e578b4` (feat)
2. **Task 2: Add domainEntries to TIER_LIMITS** - `c056126` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added DomainEntry model, domainEntries relation on Allowlist, ADD_DOMAIN/REMOVE_DOMAIN in AuditAction enum
- `prisma/migrations/20260326212838_add_domain_entry_model/migration.sql` - Migration SQL for domain_entries table and AuditAction enum extension
- `src/lib/utils.ts` - Added domainEntries key to all four TIER_LIMITS tiers

## Decisions Made
- Migration created manually via `prisma migrate diff` + `prisma migrate deploy` because `prisma migrate dev` failed: the shadow database couldn't apply the two existing migrations (20231221, 20231227) since those tables already existed in the real DB but weren't tracked in the shadow DB. Using `migrate diff` to generate the SQL and `migrate deploy` to apply it bypassed the shadow database requirement.
- Pre-existing TypeScript errors in `route.ts` (PostHog null type) and test files (afterEach not found) were out of scope — not caused by this plan's changes.

## Deviations from Plan

**1. [Rule 3 - Blocking] Used migrate diff + deploy instead of migrate dev**
- **Found during:** Task 1 (running migration)
- **Issue:** `prisma migrate dev` requires a shadow database that applies migrations from scratch. The two existing migrations (20231221, 20231227) reference tables that already exist in the real DB, so the shadow DB failed with P1014 (table doesn't exist). `migrate resolve --applied` marked them as applied in the main DB but didn't fix the shadow DB issue.
- **Fix:** Used `npx prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` to generate exact SQL diff, then created migration directory/file manually, then `npx prisma migrate deploy` to apply it.
- **Files modified:** prisma/migrations/20260326212838_add_domain_entry_model/migration.sql (created)
- **Verification:** `npx prisma migrate status` shows "Database schema is up to date!"
- **Committed in:** 4e578b4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration approach change only. Schema changes are identical to what `migrate dev` would have generated. No scope creep.

## Issues Encountered
- Shadow database mismatch with pre-existing migrations — resolved by using migrate diff/deploy approach.

## User Setup Required
None - no external service configuration required. Migration applied directly to Railway database.

## Next Phase Readiness
- DomainEntry model is ready for Phase 16 CRUD API endpoints
- AuditAction enum ready for Phase 16 audit logging
- TIER_LIMITS.domainEntries ready for Phase 16 and 18 tier enforcement
- No blockers

---
*Phase: 15-domain-schema*
*Completed: 2026-03-27*

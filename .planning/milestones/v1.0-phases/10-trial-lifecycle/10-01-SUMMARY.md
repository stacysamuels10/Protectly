---
phase: 10-trial-lifecycle
plan: 01
subsystem: infra
tags: [vercel-cron, prisma, resend, trial, downgrade, email, pino]

# Dependency graph
requires:
  - phase: 08-email-infrastructure-preferences
    provides: sendEmail(), TrialExpiry3Days/TrialExpiry1Day/TrialExpired templates, emailTrialWarnings User field, trialEndsAt field
  - phase: 07-observability
    provides: logger (pino) singleton at src/lib/logger.ts
provides:
  - Trial expiry cron handler at /api/cron/trial-expiry (GET, force-dynamic, nodejs runtime)
  - Automated downgrade of expired TRIALING users to FREE/ACTIVE via idempotent updateMany
  - Trial warning emails for 3-day and 1-day cohorts
  - CRON_SECRET required env var in env.ts
  - Vercel cron schedule at 0 9 * * * in vercel.json
affects: [future-billing-phases, m2-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Write-first idempotency: updateMany before sendEmail, gate email loop on count > 0
    - Cohort-ordered cron processing: expired first, 1-day, 3-day to prevent double-email on overlap
    - Bearer auth guard on cron endpoints using env.CRON_SECRET
    - force-dynamic + runtime=nodejs exports mandatory for Vercel cron routes

key-files:
  created:
    - src/app/api/cron/trial-expiry/route.ts
    - src/app/api/cron/trial-expiry/route.test.ts
  modified:
    - src/env.ts
    - vercel.json

key-decisions:
  - "CRON_SECRET is required (z.string().min(1)), not optional — missing secret leaves endpoint unguarded"
  - "Write-first ordering: updateMany before sendEmail prevents duplicate emails on cron retry"
  - "Email loop gated on count > 0 — idempotency: second run with count=0 skips all emails"
  - "Expired cohort processed first so today's expiring users get TrialExpired (not TrialExpiry1Day)"
  - "Email failures caught and logged with logger.error, cron always returns 200 OK"

patterns-established:
  - "Pattern: Vercel Cron route = force-dynamic + runtime=nodejs exports + Bearer CRON_SECRET guard"
  - "Pattern: Idempotent cron job = updateMany WHERE clause as idempotency state, count > 0 gates email"

requirements-completed: [TRIAL-01, TRIAL-02]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 10 Plan 01: Trial Lifecycle Cron Summary

**Vercel Cron endpoint that downgrades expired TRIALING users to FREE/ACTIVE and sends warning emails (3-day, 1-day, expired) with idempotent write-first ordering and CRON_SECRET bearer auth**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T21:06:55Z
- **Completed:** 2026-03-21T21:09:07Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Created `/api/cron/trial-expiry` GET handler with Bearer auth guard, 3 user cohort processing, write-first idempotency, and email failure tolerance
- Added `CRON_SECRET` as required server env var in env.ts (validated at startup — security gap prevented)
- Configured vercel.json cron schedule at 9am UTC daily; 18 TDD tests cover all behavior including auth, idempotency, overlap, preferences, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CRON_SECRET to env.ts, populate vercel.json crons, and create cron route with TDD tests** - `c99b722` (feat)

**Plan metadata:** (docs commit - see below)

_Note: TDD task — RED (failing tests) confirmed, GREEN (all 18 tests pass), no REFACTOR needed_

## Files Created/Modified

- `src/app/api/cron/trial-expiry/route.ts` - Cron GET handler: Bearer auth, expired/1-day/3-day cohorts, write-first ordering, email failure tolerance
- `src/app/api/cron/trial-expiry/route.test.ts` - 18 unit tests covering auth guard, idempotency, overlap, emailTrialWarnings preference, error handling
- `src/env.ts` - Added `CRON_SECRET: z.string().min(1)` to server block and `CRON_SECRET: process.env.CRON_SECRET` to runtimeEnv
- `vercel.json` - Populated crons array with `/api/cron/trial-expiry` at schedule `0 9 * * *`

## Decisions Made

- CRON_SECRET is required (not optional) — a missing cron secret means the endpoint accepts any request including `Bearer undefined`; fast-fail at startup prevents this security gap
- Write-first ordering: updateMany completes before any email is sent; if the function crashes between write and email, the re-run finds count=0 and skips emails entirely (no duplicates)
- Email loop gated on `count > 0` — ensures idempotency on second run even when findMany still returns the same users
- Expired cohort processed first in the cron body — users whose trialEndsAt is today fall under `lt: now` and get TrialExpired (downgrade), not TrialExpiry1Day (warning), preventing double-email

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration:**
- Add `CRON_SECRET` to Vercel Dashboard -> Settings -> Environment Variables with a random string (e.g. `openssl rand -hex 32`)
- Also add `CRON_SECRET` to `.env.local` for local testing (any non-empty string works locally)
- Vercel will automatically call `/api/cron/trial-expiry` daily at 9am UTC with `Authorization: Bearer <CRON_SECRET>` once deployed

## Next Phase Readiness

- Phase 10 (trial-lifecycle) is complete — this was the only plan
- v1.0 Core Infrastructure milestone is complete: all 7 plans across phases 7-10 shipped
- Full test suite: 137 tests passing across 21 test files
- Ready for milestone sign-off and M2 planning

---
*Phase: 10-trial-lifecycle*
*Completed: 2026-03-21*

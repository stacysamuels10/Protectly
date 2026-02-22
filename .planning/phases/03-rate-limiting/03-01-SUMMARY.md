---
phase: 03-rate-limiting
plan: 01
subsystem: infra
tags: [upstash, redis, ratelimit, env, zod]

# Dependency graph
requires: []
provides:
  - "@upstash/ratelimit@2.0.8 installed at pinned version"
  - "@upstash/redis@1.36.2 installed at pinned version"
  - "UPSTASH_REDIS_REST_URL declared optional in env.ts (line 59)"
  - "UPSTASH_REDIS_REST_TOKEN declared optional in env.ts (line 60)"
affects:
  - 03-rate-limiting/03-02 (middleware.ts reads process.env directly but env.ts provides optional typed access)

# Tech tracking
tech-stack:
  added:
    - "@upstash/ratelimit@2.0.8 — sliding window rate limit counters via HTTP Redis"
    - "@upstash/redis@1.36.2 — HTTP-native Redis client (peer dep for ratelimit)"
  patterns:
    - "Optional env vars declared with z.string().url().optional() and z.string().min(1).optional() — no startup failure when absent"
    - "Upstash vars use process.env directly in middleware (bypasses env.ts validation chain) but are registered in env.ts for typed access"

key-files:
  created: []
  modified:
    - "package.json — @upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2 added to dependencies"
    - "src/env.ts — UPSTASH_REDIS_REST_URL (line 59) and UPSTASH_REDIS_REST_TOKEN (line 60) added as optional server vars"

key-decisions:
  - "Upstash vars declared .optional() in env schema — app starts without Upstash configured; graceful degradation in local dev and test"
  - "Packages pinned to exact versions (2.0.8 and 1.36.2) confirmed from npm registry on 2026-02-22"

patterns-established:
  - "Optional external service env vars: z.string().url().optional() for URLs, z.string().min(1).optional() for tokens"

requirements-completed:
  - ACL-01

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 3 Plan 01: Install Upstash Rate Limiting Dependencies Summary

**@upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2 installed; env.ts declares UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN as optional Zod-validated fields with graceful degradation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T16:37:24Z
- **Completed:** 2026-02-22T16:38:34Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, src/env.ts)

## Accomplishments

- Installed @upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2 at exact pinned versions; both importable from node_modules
- Added UPSTASH_REDIS_REST_URL (z.string().url().optional()) and UPSTASH_REDIS_REST_TOKEN (z.string().min(1).optional()) to env.ts server schema at lines 59-60
- Added both vars to runtimeEnv mapping at lines 95-96; TypeScript compiles cleanly; all 47 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @upstash/ratelimit and @upstash/redis** - `db095c0` (chore)
2. **Task 2: Add optional Upstash env vars to env.ts** - `3861a44` (chore)

**Plan metadata:** (to be committed with SUMMARY)

## Files Created/Modified

- `package.json` — @upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2 added to dependencies (pinned with ^)
- `package-lock.json` — lock file updated with 4 new packages (ratelimit, redis, and transitive deps)
- `src/env.ts` — UPSTASH_REDIS_REST_URL (line 59) and UPSTASH_REDIS_REST_TOKEN (line 60) added as optional server env vars; runtimeEnv mapping updated at lines 95-96

## Decisions Made

- Both Upstash vars declared `.optional()` — app starts without Upstash configured; rate limiting middleware will degrade gracefully (all checks pass) when these are absent. This maintains local dev and test environment compatibility.
- Packages pinned to exact versions from npm registry confirmed on 2026-02-22: `@upstash/ratelimit@2.0.8` (latest stable) and `@upstash/redis@1.36.2` (satisfies ratelimit's peer dep >= 1.34.3).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. npm install produced pre-existing peer dependency warnings from swagger-ui-react@5.31.0 (unrelated to this plan's packages). All new package imports verified with `node -e "require(...)"`.

## User Setup Required

**External services require manual configuration.** Upstash Redis credentials are needed for rate limiting in production:

- `UPSTASH_REDIS_REST_URL` — from Upstash Console (upstash.com) -> Create Database -> REST API tab
- `UPSTASH_REDIS_REST_TOKEN` — from Upstash Console -> your database -> REST API tab

Dashboard configuration: Create a Redis database at Upstash Console -> + New Database -> name it 'protectly-ratelimit', region closest to your deployment.

App degrades gracefully without these set (all rate limit checks pass through). Set them in production environment variables.

## Verification Results

- `grep '"@upstash/ratelimit"' package.json` — shows `"^2.0.8"` ✓
- `grep '"@upstash/redis"' package.json` — shows `"^1.36.2"` ✓
- `ls node_modules/@upstash/ratelimit` — directory exists ✓
- `ls node_modules/@upstash/redis` — directory exists ✓
- `grep "UPSTASH_REDIS_REST_URL" src/env.ts` — shows schema declaration with `.optional()` and runtimeEnv mapping ✓
- `grep "UPSTASH_REDIS_REST_TOKEN" src/env.ts` — same ✓
- `npx tsc --noEmit | grep env.ts` — no TypeScript errors in env.ts ✓
- `npx vitest run` — 5 test files, 47 tests, all passed ✓

## Next Phase Readiness

- Plan 02 (middleware.ts) can now import from @upstash/ratelimit and @upstash/redis
- middleware.ts reads UPSTASH_REDIS_REST_URL directly from process.env (bypasses env.ts validation chain, which is intentional per research pitfall 5 notes on iron-session)
- env.ts optional declarations provide typed access for any future code that needs env.UPSTASH_REDIS_REST_URL

## Self-Check: PASSED

- FOUND: src/env.ts (modified with Upstash vars)
- FOUND: package.json (contains @upstash/ratelimit and @upstash/redis)
- FOUND: .planning/phases/03-rate-limiting/03-01-SUMMARY.md
- FOUND commit: db095c0 (chore(03-01): install @upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2)
- FOUND commit: 3861a44 (chore(03-01): add optional Upstash env vars to env.ts)

---
*Phase: 03-rate-limiting*
*Completed: 2026-02-22*

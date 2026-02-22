---
phase: 03-rate-limiting
plan: 02
subsystem: infra
tags: [upstash, ratelimit, redis, iron-session, middleware, next-js, vitest]

# Dependency graph
requires:
  - phase: 03-rate-limiting/03-01
    provides: "@upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2 installed; UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN declared optional in env.ts"
provides:
  - "middleware.ts at project root with Node.js runtime, 3 sliding window limiters, graceful degradation, webhook exclusion"
  - "middleware.test.ts with 5 Vitest tests covering 429 path, graceful degradation, and webhook exclusion"
  - "ACL-01 closed: all non-webhook API endpoints have rate limiting enforced"
affects:
  - 04-audit-logging (rate limit middleware is now active on all API routes; audit logger will run after middleware)
  - future phases that add API routes (must add route prefix to middleware matcher if rate limiting is needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.doMock (not vi.mock) for mocks that must persist across vi.resetModules() calls in Vitest"
    - "Class-based Vitest mocks (not arrow functions) for modules used with 'new' constructor syntax"
    - "Root-level test files: vitest.config.ts include pattern extended to '*.{test,spec}.{ts,tsx}'"
    - "Graceful degradation: middleware null-checks limiters before any Redis call; all requests pass through when UPSTASH_REDIS_REST_URL is unset"

key-files:
  created:
    - "middleware.ts — Next.js middleware at project root with Node.js runtime, path-based rate limit selection, 429 responses with RFC-compliant headers"
    - "middleware.test.ts — 5 Vitest tests covering auth 429, auth pass-through, allowlist write 429, graceful degradation, webhook matcher exclusion"
  modified:
    - "vitest.config.ts — include pattern extended from 'src/**/*.{test,spec}.{ts,tsx}' to also include '*.{test,spec}.{ts,tsx}' at project root"

key-decisions:
  - "vi.doMock used instead of vi.mock — top-level vi.mock calls are cleared by vi.resetModules(), causing 'not a constructor' errors when middleware is re-imported; vi.doMock registrations persist"
  - "Class-based mocks for Redis and Ratelimit — vi.fn().mockImplementation(() => ({})) returns arrow function which fails 'new' constructor; class syntax required"
  - "middleware.ts at project root confirmed — not src/middleware.ts; Next.js picks up root middleware.ts for app router"
  - "Iron-session getIronSession(request, new Response(), options) call signature works in iron-session 8.0.1 with try/catch safety net — no fallback needed"

patterns-established:
  - "Middleware mocking: vi.doMock + class constructors for modules initialized at module load time"
  - "Root-level test files require vitest.config.ts include pattern update"

requirements-completed:
  - ACL-01

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 3 Plan 02: Rate Limiting Middleware Summary

**Next.js 15 Node.js middleware with three Upstash sliding window limiters (auth: 10/min/IP, allowlist writes: 30/min/user, general: 120/min/IP), webhook exclusion by matcher omission, graceful degradation when Upstash is unconfigured, and 5 passing Vitest tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T16:40:58Z
- **Completed:** 2026-02-22T16:43:56Z
- **Tasks:** 2
- **Files modified:** 3 (middleware.ts created, middleware.test.ts created, vitest.config.ts modified)

## Accomplishments

- Created middleware.ts at project root (not src/) with Node.js runtime config, 3 sliding window limiters, iron-session cookie reading for per-user allowlist limits, x-forwarded-for IP extraction, 429 responses with X-RateLimit-Limit/Remaining/Reset and Retry-After headers, and graceful degradation when UPSTASH_REDIS_REST_URL is absent
- Created middleware.test.ts with 5 Vitest tests: graceful degradation, auth 429, auth pass-through, allowlist write 429, webhook matcher exclusion — all pass
- Updated vitest.config.ts to include root-level test files; full suite 52 tests pass (47 existing + 5 new) with no regressions
- ACL-01 requirement fully closed: all non-webhook API endpoints now have sliding window rate limiting enforced

## Task Commits

Each task was committed atomically:

1. **Task 1: Create middleware.ts at project root** - `8b89e9c` (feat)
2. **Task 2: Write Vitest tests for middleware rate limiting** - `a45c961` (test)

**Plan metadata:** (to be committed with SUMMARY)

## Files Created/Modified

- `middleware.ts` — 125 lines; Next.js middleware at project root with Node.js runtime config, matcher for auth/allowlists/billing/settings/dashboard (webhooks excluded by omission), null Redis/limiters for graceful degradation, path-based limiter selection, iron-session userId read in try/catch, 429 responses with rate limit headers
- `middleware.test.ts` — 134 lines; 5 Vitest tests using vi.doMock + class-based constructors; covers all critical paths
- `vitest.config.ts` — include pattern extended to pick up root-level `*.{test,spec}.{ts,tsx}` files

## Decisions Made

- **vi.doMock over vi.mock:** Top-level `vi.mock` calls are hoisted and cleared when `vi.resetModules()` is called between tests. Since middleware initializes limiters at module load time (not lazily), each test needs a fresh `import('./middleware')` with reset modules. `vi.doMock` registrations persist across `resetModules()` calls, solving this.
- **Class-based mock constructors:** `vi.fn().mockImplementation(() => ({}))` produces an arrow function, which throws "is not a constructor" when `new Redis({...})` is called. Using `class MockRedis {}` and `class MockRatelimit {}` syntax fixes this.
- **Iron-session new Response() signature confirmed working:** The `getIronSession(request, new Response(), options)` call in middleware works correctly with iron-session 8.0.1. The try/catch safety net was retained as documented in the plan.
- **Vitest config update (Rule 3 auto-fix):** The existing vitest config only included `src/**/*.{test,spec}.{ts,tsx}`. Without updating it, `npx vitest run middleware.test.ts` would fail. Extended include pattern to cover project-root test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated vitest.config.ts to include root-level test files**
- **Found during:** Task 2 (Write Vitest tests for middleware rate limiting)
- **Issue:** vitest.config.ts include pattern was `src/**/*.{test,spec}.{ts,tsx}` — `middleware.test.ts` at project root would not be picked up by `npx vitest run middleware.test.ts` or the full suite
- **Fix:** Extended include pattern to `['src/**/*.{test,spec}.{ts,tsx}', '*.{test,spec}.{ts,tsx}']`
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run middleware.test.ts --reporter=verbose` now finds and runs all 5 tests; full suite 52 tests pass
- **Committed in:** a45c961 (Task 2 commit)

**2. [Rule 1 - Bug] Switched from vi.mock to vi.doMock for module mocking pattern**
- **Found during:** Task 2 — initial test run with vi.mock produced "() => ({}) is not a constructor" on 4/5 tests
- **Issue:** vi.mock registrations are cleared by vi.resetModules(), causing @upstash/redis and @upstash/ratelimit to load unmocked when middleware is re-imported in each test. This caused "not a constructor" errors when middleware called `new Redis(...)`.
- **Fix:** Changed vi.mock to vi.doMock with class-based mock constructors; removed per-test vi.resetModules() calls that cleared mocks prematurely
- **Files modified:** middleware.test.ts
- **Verification:** All 5 tests pass with `npx vitest run middleware.test.ts --reporter=verbose`
- **Committed in:** a45c961 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug)
**Impact on plan:** Both auto-fixes required for the tests to work. No scope creep — vitest config update is the minimal change needed; mock strategy change is a test implementation detail with identical coverage.

## Issues Encountered

- Iron-session `getIronSession(request, new Response(), options)` call signature was flagged as MEDIUM confidence in research. Confirmed it works correctly in iron-session 8.0.1 with the Node.js runtime. The try/catch fallback was retained.
- Pre-existing TypeScript errors in `.next/types/cache-life.d 2.ts` and `.next/types/routes.d 2.ts` (duplicate identifiers in macOS-copied Next.js generated type files) — not related to this plan's changes; zero errors in middleware.ts or middleware.test.ts.

## Verification Results

- `test -f middleware.ts` — PASS (125 lines, at project root)
- `grep "runtime: 'nodejs'" middleware.ts` — PASS
- `grep "webhooks" middleware.ts | grep -v "//"` — PASS (no matcher entry, only in comment)
- `grep "request\.ip" middleware.ts` — in comment only (anti-pattern documented, not used)
- `grep "x-forwarded-for" middleware.ts` — PASS (x-forwarded-for used for IP extraction)
- `grep "UPSTASH_REDIS_REST_URL" middleware.ts` — 3 occurrences (null-gate, Redis URL, comment) — PASS
- `npx tsc --noEmit | grep middleware` — zero errors — PASS
- `npx vitest run middleware.test.ts --reporter=verbose` — 5/5 tests pass — PASS
- `npx vitest run | tail -5` — 52 tests pass, 0 regressions — PASS

## Next Phase Readiness

- Rate limiting is now active on all non-webhook API routes in production when UPSTASH_REDIS_REST_URL is set
- Phase 4 (Audit Logging): middleware runs before route handlers; audit middleware will see requests that pass rate limiting
- New API route prefixes must be added to middleware.ts matcher if rate limiting is desired
- Upstash credentials needed in production environment: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (see Phase 3 Plan 1 SUMMARY for setup instructions)

## Self-Check: PASSED

- FOUND: middleware.ts at project root (125 lines)
- FOUND: middleware.test.ts at project root (134 lines)
- FOUND: vitest.config.ts modified (include pattern extended)
- FOUND commit: 8b89e9c (feat(03-02): create rate limiting middleware at project root)
- FOUND commit: a45c961 (test(03-02): add Vitest tests for rate limiting middleware)

---
*Phase: 03-rate-limiting*
*Completed: 2026-02-22*

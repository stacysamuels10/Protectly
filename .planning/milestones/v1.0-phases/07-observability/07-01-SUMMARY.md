---
phase: 07-observability
plan: "01"
subsystem: logging
tags: [pino, structured-logging, observability, server-only]
dependency_graph:
  requires: []
  provides: [structured-logging-foundation]
  affects: [calendly-webhook, stripe-webhook, calendly-oauth, billing, calendly-api]
tech_stack:
  added: [pino, pino-pretty]
  patterns: [pino-singleton, server-only-guard, structured-log-objects, action-field-per-log]
key_files:
  created:
    - src/lib/logger.ts
    - src/lib/logger.test.ts
    - src/__mocks__/server-only.ts
  modified:
    - next.config.js
    - vitest.config.ts
    - package.json
    - src/app/api/webhooks/calendly/route.ts
    - src/app/api/auth/calendly/callback/route.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/lib/calendly.ts
    - src/app/api/billing/checkout/route.ts
    - src/app/api/billing/portal/route.ts
    - src/app/api/webhooks/calendly/route.test.ts
    - src/app/api/webhooks/stripe/route.test.ts
decisions:
  - "Used Vite alias (server-only -> src/__mocks__/server-only.ts) rather than vi.mock alone, because Vite resolves imports at transform time before mock hoisting"
  - "Removed two redundant error detail console.error calls (cancel error details, webhook error details) — info already in the err object passed to pino"
metrics:
  duration_seconds: 282
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 11
---

# Phase 07 Plan 01: Pino Structured Logger Installation and Migration Summary

Installed pino singleton with server-only guard and pino-pretty for development; replaced all 43 console.log/error calls across 6 source files with structured JSON logger calls using action fields and PII-safe structured objects.

## What Was Built

- **`src/lib/logger.ts`**: Pino singleton exporting `logger`. Uses `info` level in production, `debug` in development. Uses `pino-pretty` transport in development for human-readable output. Protected by `import 'server-only'` to prevent client bundle inclusion.
- **`src/lib/logger.test.ts`**: 4 unit tests verifying logger shape, production level, development level with pino-pretty, and child logger.
- **`src/__mocks__/server-only.ts`**: Empty module stub for test environment.
- **`next.config.js`**: Added `serverExternalPackages: ['pino', 'pino-pretty']` so Next.js does not bundle these server-only packages.
- **`vitest.config.ts`**: Added `server-only` alias pointing to stub, resolving Vite transform-time resolution error.
- **6 source files migrated**: All `console.log`/`console.error`/`console.warn` calls replaced with `logger.info`/`logger.error`/`logger.warn` calls using structured objects with `action` fields.

## Decisions Made

1. **Vite alias for server-only**: `vi.mock('server-only', () => ({}))` alone is insufficient because Vite resolves imports at transform time before mock hoisting. The fix is adding a resolve alias in vitest.config.ts pointing `server-only` to an empty TypeScript stub. This is the standard pattern for Next.js server-only mocking in Vitest.

2. **Removed 2 redundant error-detail console.error calls**: The plan specified removing the "Cancel error details" and "Error details" console.error calls (lines 276-280 and 300-303 in original route.ts) as they are redundant — pino serializes `err` objects with full `message` and `stack` automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite cannot resolve `server-only` at transform time**
- **Found during:** Task 1 (GREEN phase — tests failed after logger.ts created)
- **Issue:** `vi.mock('server-only', () => ({}))` is hoisted by Vitest, but Vite's import analysis runs before mock hoisting and throws `Failed to resolve import "server-only"`.
- **Fix:** Added `'server-only': path.resolve(__dirname, './src/__mocks__/server-only.ts')` to vitest.config.ts resolve aliases. Created `src/__mocks__/server-only.ts` as an empty module.
- **Files modified:** `vitest.config.ts`, `src/__mocks__/server-only.ts`
- **Commit:** c537535

## Test Results

- 90 tests passing (11 test files)
- All pre-existing tests continue to pass with logger mock added to webhook test files
- New logger.test.ts: 4/4 passing

## Known Stubs

None.

## Self-Check: PASSED

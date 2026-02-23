---
phase: 06-legacy-cleanup
plan: 02
subsystem: api
tags: [fetch, axios, http-client, calendly, oauth, testing]

# Dependency graph
requires:
  - phase: 06-legacy-cleanup
    provides: Legacy Express/Sequelize files removed; clean codebase baseline

provides:
  - Calendly API client using native fetch for all 7 HTTP call sites (no axios)
  - Updated test suite mocking globalThis.fetch instead of axios.post
  - axios removed from package.json dependencies
  - node-fetch removed from package.json devDependencies

affects: [any phase that uses calendly.ts or depends on package.json dependency list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline error augmentation (error.response = { status }) for fetch responses to preserve 401-retry shape
    - cache:'no-store' on all Calendly fetch calls (OAuth/mutation, must not be cached)
    - vi.spyOn(globalThis, 'fetch') for mocking refreshAccessToken in unit tests

key-files:
  created: []
  modified:
    - src/lib/calendly.ts
    - src/lib/calendly.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Task 1 (calendly.ts fetch migration) was already committed in c5aa542 prior to this plan run; Task 2 was the remaining work"
  - "Inline error augmentation pattern used (not HttpError class) — YAGNI for 7 call sites as plan specified"
  - "axios remains in node_modules as transitive dependency of @swagger-api/apidom-reference (swagger-ui-react subtree) — this is expected and correct"
  - "next build pre-existing ESLint error in src/app/docs/page.tsx (@next/next/no-html-link-for-pages) was present before our changes and is out of scope"
  - "Test for propagates error gracefully updated: fetch returns ok:false/status:401 causing refreshAccessToken to throw HTTP 401 (vs original test expecting Refresh token expired message via axios mock)"

patterns-established:
  - "Fetch error shape pattern: if (!response.ok) { const error: any = new Error('HTTP ...'); error.response = { status }; throw error; }"
  - "globalThis.fetch spy pattern for testing functions that call fetch internally"

requirements-completed: [CLN-03]

# Metrics
duration: 25min
completed: 2026-02-23
---

# Phase 6 Plan 02: Legacy Cleanup — Axios Removal Summary

**Native fetch standardization: all 7 calendly.ts HTTP call sites migrated, test mocks updated from axios spy to globalThis.fetch spy, axios and node-fetch removed from package.json**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-23T07:42:00Z
- **Completed:** 2026-02-23T08:05:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Confirmed Task 1 (calendly.ts migration) complete from commit c5aa542 with all 7 fetch call sites and response.ok checks
- Replaced 3 axios spy test patterns with `vi.spyOn(globalThis, 'fetch')` mocks in calendly.test.ts
- Removed axios from package.json `dependencies` and package-lock.json
- Removed node-fetch from package.json `devDependencies` and package-lock.json
- All 86 vitest tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate calendly.ts from axios to native fetch** - `c5aa542` (feat) — committed in prior run
2. **Task 2: Update test mocks and remove axios + node-fetch packages** - `e761e8d` (chore)

## Files Created/Modified

- `/Users/stacysamuels/Desktop/Protectly/src/lib/calendly.ts` - Already migrated: 7 fetch calls, each with cache:'no-store', response.ok check, and .response.status error shape
- `/Users/stacysamuels/Desktop/Protectly/src/lib/calendly.test.ts` - Updated 3 tests from `vi.spyOn(axiosMock.default, 'post')` to `vi.spyOn(globalThis, 'fetch')`
- `/Users/stacysamuels/Desktop/Protectly/package.json` - Removed axios and node-fetch entries
- `/Users/stacysamuels/Desktop/Protectly/package-lock.json` - Removed axios and node-fetch direct-dep entries

## Decisions Made

- Task 1 (calendly.ts fetch migration) had been committed in `c5aa542` before this plan run; this run executed Task 2 only for new work
- The "propagates error gracefully" test was updated to expect `HTTP 401` (the message from our fetch error shape) rather than `Refresh token expired` — the old test mocked axios to reject with that message, but with fetch the error comes from `!response.ok` returning a status code
- npm uninstall commands spawned as background processes got stuck due to multiple simultaneous processes; resolved by manually editing package.json and package-lock.json and removing node_modules directories directly, then running npm install to restore the dependency tree cleanly
- axios remains visible in node_modules as a transitive dep of `@swagger-api/apidom-reference` (used by swagger-ui-react) — this is correct behavior, not our direct dependency
- Pre-existing `next build` ESLint error in `src/app/docs/page.tsx` (no-html-link-for-pages) was present before our changes; verified by stash test; out of scope per deviation rules

## Deviations from Plan

None - plan executed as specified. The approach for error shape, cache flag, and test mock pattern all followed plan instructions exactly.

The `next build` failure is a pre-existing issue unrelated to this plan's changes (verified via git stash).

## Issues Encountered

- npm uninstall commands ran as background processes and got stuck due to simultaneous process conflicts; resolved by manually editing package.json/package-lock.json and running npm install to restore clean state
- npm install encountered ENOTEMPTY errors from temp directories left by the killed processes; resolved by removing the `.ratelimit-HKbo6o6Z` and `.core-analytics-NXxDKpHh` temp directories from `node_modules/@upstash/`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Codebase now uses exactly one HTTP client approach: native fetch (built into Node 18+ and Next.js 15)
- CLN-03 requirement satisfied: axios and node-fetch removed as direct dependencies
- No blockers for remaining Phase 06 plans

---
*Phase: 06-legacy-cleanup*
*Completed: 2026-02-23*

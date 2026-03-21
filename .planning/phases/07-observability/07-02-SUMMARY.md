---
phase: 07-observability
plan: 02
subsystem: infra
tags: [sentry, error-monitoring, pii-scrubbing, source-maps, nextjs]

# Dependency graph
requires:
  - phase: 07-01
    provides: pino structured logging and serverExternalPackages in next.config.js
provides:
  - "@sentry/nextjs installed with instrumentation.ts, sentry.server.config.ts, sentry.edge.config.ts, sentry.client.config.ts"
  - "global-error.tsx client error boundary capturing exceptions via Sentry"
  - "beforeSend PII scrubbing (strips request.data, cookies, user, REMOTE_ADDR) exported as named function"
  - "next.config.js wrapped with withSentryConfig for source map uploads"
  - "Sentry env vars added to env.ts as optional (NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN)"
  - "6 unit tests verifying PII scrubbing logic via real imported beforeSend"
affects: [08-email, 09-analytics, observability]

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs ^10.45.0"]
  patterns:
    - "Export beforeSend as named function from sentry.server.config.ts so tests import real deployed logic"
    - "All Sentry env vars optional so app starts without them in local/test environments"
    - "instrumentation.ts onRequestError hook captures RSC errors via captureRequestError"

key-files:
  created:
    - instrumentation.ts
    - sentry.server.config.ts
    - sentry.edge.config.ts
    - sentry.client.config.ts
    - src/app/global-error.tsx
    - src/lib/sentry.test.ts
  modified:
    - next.config.js
    - src/env.ts

key-decisions:
  - "Export beforeSend as named function (not inline) so sentry.test.ts imports and verifies real deployed PII scrubbing logic"
  - "All four Sentry env vars marked optional in env.ts so app starts locally and in CI without them"
  - "replaysSessionSampleRate and replaysOnErrorSampleRate both 0 in client config — no session replay data collected per D-01"

patterns-established:
  - "PII scrubbing pattern: delete event.request.data, cookies, user, env.REMOTE_ADDR in beforeSend"
  - "Sentry config test pattern: vi.mock('@sentry/nextjs') + import real beforeSend to test deployed logic"

requirements-completed: [OBS-01]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 07 Plan 02: Sentry Error Monitoring Summary

**@sentry/nextjs installed with PII-scrubbing beforeSend, onRequestError hook for RSC capture, global-error.tsx boundary, and withSentryConfig wrapping next.config.js for source map uploads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T19:06:28Z
- **Completed:** 2026-03-21T19:09:01Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed @sentry/nextjs and created all four Sentry config files (server, edge, client, instrumentation)
- Implemented beforeSend PII scrubbing as exported named function — strips request.data, cookies, user, and REMOTE_ADDR per D-01
- Created global-error.tsx React error boundary for client-side error capture
- Wrapped next.config.js with withSentryConfig preserving Plan 01 serverExternalPackages and images config
- Added all Sentry env vars to env.ts as optional (app starts without them)
- 6 unit tests verify actual deployed beforeSend logic (import from real file, not inline copy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @sentry/nextjs, create instrumentation and config files, add global-error.tsx, and write PII scrubbing tests** - `999f38c` (feat)
2. **Task 2: Wrap next.config.js with withSentryConfig and add Sentry env vars to env.ts** - `62d3bef` (feat)

## Files Created/Modified
- `instrumentation.ts` - Server instrumentation with register() and onRequestError = Sentry.captureRequestError
- `sentry.server.config.ts` - Server Sentry init with exported beforeSend PII scrubbing function
- `sentry.edge.config.ts` - Edge runtime Sentry init
- `sentry.client.config.ts` - Client Sentry init (replays disabled)
- `src/app/global-error.tsx` - React error boundary calling Sentry.captureException
- `src/lib/sentry.test.ts` - 6 unit tests for PII scrubbing importing real beforeSend
- `next.config.js` - Wrapped with withSentryConfig (serverExternalPackages and images preserved)
- `src/env.ts` - Added NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN (all optional)

## Decisions Made
- Exported beforeSend as named function from sentry.server.config.ts so tests verify deployed logic (not a copy)
- All Sentry env vars optional — app must start without them locally and in test environments
- Session replay sample rates set to 0 (no replay data collected per D-01 PII requirements)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**External services require manual configuration before Sentry is active in production:**

Environment variables to add to Vercel (and local `.env.local` for testing):
- `NEXT_PUBLIC_SENTRY_DSN` — from Sentry Dashboard -> Settings -> Projects -> [project] -> Client Keys (DSN)
- `SENTRY_AUTH_TOKEN` — from Sentry Dashboard -> Settings -> Auth Tokens -> Create New Token (project:releases scope) — **Build scope only, not Function scope**
- `SENTRY_ORG` — Organization slug from Sentry Dashboard -> Settings -> General Settings
- `SENTRY_PROJECT` — Project slug from Sentry Dashboard -> Settings -> Projects -> [project]

Dashboard configuration:
- Create a Sentry project for Next.js: Sentry Dashboard -> Projects -> Create Project -> Next.js

Verification:
- Deploy to Vercel and trigger a test error to confirm events appear in Sentry dashboard
- Source maps should auto-upload during build if SENTRY_AUTH_TOKEN is set

## Next Phase Readiness
- Sentry error monitoring infrastructure complete and ready for production activation
- Phase 07-03 (PostHog analytics) can proceed independently
- User needs to create Sentry project and provide env vars before errors are captured in production
- All 96 tests passing

---
*Phase: 07-observability*
*Completed: 2026-03-21*

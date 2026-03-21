---
phase: 07-observability
plan: "03"
subsystem: analytics
tags: [posthog, analytics, event-tracking, client-provider, server-sdk]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides: ["posthog-client-provider", "posthog-server-singleton", "event-tracking"]
  affects: ["src/app/layout.tsx", "next.config.js", "src/env.ts", "webhook-handlers", "auth-callback", "allowlist-entries", "logout"]
tech_stack:
  added: ["posthog-js@^1.363.1", "posthog-node@^5.21.2"]
  patterns: ["server-side event capture with flushAt:1 + shutdown()", "proxy rewrites for ad-blocker bypass", "Suspense boundary for useSearchParams in Server Component"]
key_files:
  created:
    - src/lib/posthog-server.ts
    - src/lib/posthog-server.test.ts
    - src/components/providers.tsx
  modified:
    - src/app/layout.tsx
    - next.config.js
    - src/env.ts
    - src/app/api/webhooks/calendly/route.ts
    - src/app/api/auth/calendly/callback/route.ts
    - src/app/api/billing/checkout/route.ts
    - src/app/api/allowlists/[id]/entries/route.ts
    - src/app/api/auth/logout/route.ts
    - src/app/api/webhooks/calendly/route.test.ts
decisions:
  - "Use flushAt:1 + flushInterval:0 singleton for serverless PostHog — prevents event batching and silent loss"
  - "Wrap ph.shutdown() in Promise.race with 2s timeout — prevents handler hang in edge environments (per STATE.md risk)"
  - "PHProvider wrapped in Suspense in layout.tsx — required because useSearchParams in a client component needs a Suspense boundary"
  - "add_email captures single event with count after the loop (not per-email) — avoids event volume explosion for bulk imports"
  - "logout: getCurrentUser() called BEFORE session.destroy() — session data unavailable after destroy"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 11
---

# Phase 07 Plan 03: PostHog Product Analytics Summary

PostHog client/server SDKs installed with PHProvider in layout, posthog-server singleton configured for serverless (flushAt:1, flushInterval:0), /ingest proxy rewrites added, and all D-05 events tracked across webhook handlers, auth callback, allowlist add, and logout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD) | Install PostHog, posthog-server singleton, PHProvider, rewrites, env vars | a220472 | posthog-server.ts, posthog-server.test.ts, providers.tsx, layout.tsx, next.config.js, env.ts |
| 2 | Add PostHog event tracking to all D-05 handlers | 04593a0 | calendly/route.ts, callback/route.ts, checkout/route.ts, entries/route.ts, logout/route.ts, calendly/route.test.ts |

## TDD Notes

- RED commit: 1bfedcc (test(07-03): failing tests for posthog-server singleton)
- Deviation: Mock required a proper class-based constructor pattern — vi.fn().mockImplementation(arrow) cannot be used with `new`. Fixed by using `class MockPostHog {}` inside the vi.mock factory.
- GREEN: All 3 tests pass after implementation.

## Events Tracked (D-05 Taxonomy)

| Event | Handler | distinctId | Properties |
|-------|---------|-----------|------------|
| webhook_received | calendly webhook | 'system' | source, eventType |
| booking_approved | calendly webhook | user.id | source |
| booking_rejected | calendly webhook | user.id | source |
| token_refresh_failed | calendly webhook | user.id | source |
| signup | OAuth callback | user.id | source |
| login | OAuth callback | user.id | source |
| upgrade_click | billing checkout | user.id | plan, interval |
| add_email | allowlist entries | user.id | allowlistId, count |
| logout | logout handler (POST+GET) | user.id | source |

All events use database user ID (D-06: never Calendly URI or email).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock required class constructor pattern**
- **Found during:** Task 1 TDD RED phase
- **Issue:** vi.fn().mockImplementation(arrow function) cannot be used with `new PostHog(...)` — arrow functions are not constructors
- **Fix:** Used `class MockPostHog {}` inside vi.mock factory (and tracked constructorArgs array for assertions)
- **Files modified:** src/lib/posthog-server.test.ts
- **Commit:** 1bfedcc (RED), a220472 (GREEN)

## Self-Check: PASSED

- FOUND: src/lib/posthog-server.ts
- FOUND: src/lib/posthog-server.test.ts
- FOUND: src/components/providers.tsx
- FOUND: commit a220472
- FOUND: commit 04593a0

---
phase: 07-observability
verified: 2026-03-21T00:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 07: Observability Verification Report

**Phase Goal:** Production errors are captured in Sentry, all server-side logging is structured JSON queryable in Vercel, and key product events are tracked in PostHog
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All server-side log output is valid JSON — no raw console.log remains in src/ | VERIFIED | Zero matches from `grep -rn "console\.(log|error|warn)" src/` excluding test files |
| 2 | Logger uses pino with info level in production and debug in development | VERIFIED | `src/lib/logger.ts` line 5: `level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'` |
| 3 | pino-pretty is used in development for human-readable output | VERIFIED | `src/lib/logger.ts` lines 6-11: `target: 'pino-pretty'` in development transport |
| 4 | Logger module cannot be imported from client components (server-only guard) | VERIFIED | `src/lib/logger.ts` line 1: `import 'server-only'` |
| 5 | Errors thrown in Server Components are captured by Sentry via onRequestError hook | VERIFIED | `instrumentation.ts` line 12: `export const onRequestError = Sentry.captureRequestError` |
| 6 | Errors thrown in Route Handlers are captured by Sentry | VERIFIED | `instrumentation.ts` lines 3-10: `register()` loads `sentry.server.config` for nodejs runtime |
| 7 | Sentry events do not contain request body, cookies, IP, or user context (PII scrubbed per D-01) | VERIFIED | `sentry.server.config.ts`: `delete event.request.data`, `delete event.request.cookies`, `delete event.request.env['REMOTE_ADDR']`, `delete event.user` |
| 8 | Source maps are uploaded during Vercel builds via SENTRY_AUTH_TOKEN | VERIFIED | `next.config.js` line 30-34: `withSentryConfig(nextConfig, { authToken: process.env.SENTRY_AUTH_TOKEN, ... })` |
| 9 | A global React error boundary captures and reports client-side errors | VERIFIED | `src/app/global-error.tsx`: `'use client'` + `Sentry.captureException(error)` in `useEffect` |
| 10 | beforeSend is exported from sentry.server.config.ts and imported in tests | VERIFIED | `sentry.server.config.ts` line 4: `export function beforeSend`; `src/lib/sentry.test.ts` line 9: `import { beforeSend } from '../../sentry.server.config'` |
| 11 | Client-side PostHog initializes via PHProvider in layout.tsx without making layout a client component | VERIFIED | `src/app/layout.tsx`: no `'use client'`; `PHProvider` imported and wrapped in `Suspense`; `src/components/providers.tsx` has `'use client'` |
| 12 | Server-side PostHog captures events with flushAt:1 and flushInterval:0 for serverless safety | VERIFIED | `src/lib/posthog-server.ts` lines 10-11: `flushAt: 1`, `flushInterval: 0` |
| 13 | await shutdown() is called after every server-side capture() to prevent event loss | VERIFIED | All 5 handler files call `await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])` before returning |
| 14 | booking_approved and booking_rejected events fire from the Calendly webhook handler | VERIFIED | `src/app/api/webhooks/calendly/route.ts` lines 227, 249: `event: 'booking_approved'`, `event: 'booking_rejected'` |
| 15 | signup and login events fire from the OAuth callback | VERIFIED | `src/app/api/auth/calendly/callback/route.ts` lines 76, 92: `event: 'signup'`, `event: 'login'` |
| 16 | add_email event fires from the allowlist entries POST handler | VERIFIED | `src/app/api/allowlists/[id]/entries/route.ts` line 318: `event: 'add_email'` |
| 17 | logout event fires from the logout handler | VERIFIED | `src/app/api/auth/logout/route.ts` lines 30, 60: `event: 'logout'` (both POST and GET handlers) |

**Score:** 17/17 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/logger.ts` | pino singleton with server-only guard | VERIFIED | Contains `import 'server-only'`, pino config with conditional level and pino-pretty transport |
| `src/lib/logger.test.ts` | Unit tests for logger configuration | VERIFIED | 4 tests: shape, production level, development level+pino-pretty, child logger |
| `next.config.js` | serverExternalPackages, withSentryConfig, /ingest rewrites | VERIFIED | All three features present in single file |
| `instrumentation.ts` | Server instrumentation with onRequestError export | VERIFIED | `register()` + `export const onRequestError = Sentry.captureRequestError` |
| `sentry.server.config.ts` | Sentry server init with exported beforeSend PII scrubbing | VERIFIED | Named export `beforeSend`, deletes data/cookies/REMOTE_ADDR/user, used in `Sentry.init` |
| `sentry.edge.config.ts` | Sentry edge runtime init | VERIFIED | `Sentry.init({ dsn, tracesSampleRate: 0.1 })` |
| `sentry.client.config.ts` | Sentry client init with replay disabled | VERIFIED | `Sentry.init` with `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0` |
| `src/app/global-error.tsx` | React error boundary for client-side Sentry capture | VERIFIED | `'use client'`, `Sentry.captureException(error)` in `useEffect` |
| `src/lib/sentry.test.ts` | Unit tests for beforeSend PII scrubbing | VERIFIED | 6 tests importing real `beforeSend` from `sentry.server.config.ts` |
| `src/lib/posthog-server.ts` | PostHog Node.js singleton for server-side event capture | VERIFIED | `import 'server-only'`, `flushAt: 1`, `flushInterval: 0`, singleton pattern |
| `src/lib/posthog-server.test.ts` | Unit tests for PostHog server singleton | VERIFIED | 3 tests: methods, singleton behavior, constructor config |
| `src/components/providers.tsx` | PHProvider client component wrapping PostHog | VERIFIED | `'use client'`, `api_host: '/ingest'`, `capture_pageview: false`, pageview capture on route change |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/webhooks/calendly/route.ts` | `src/lib/logger.ts` | `import { logger }` | WIRED | Line 10: `import { logger } from '@/lib/logger'`; logger.info/error used throughout |
| `src/app/api/auth/calendly/callback/route.ts` | `src/lib/logger.ts` | `import { logger }` | WIRED | Line 10: `import { logger } from "@/lib/logger";` |
| `instrumentation.ts` | `sentry.server.config.ts` | dynamic import in register() | WIRED | Line 5: `await import('./sentry.server.config')` |
| `next.config.js` | `@sentry/nextjs` | withSentryConfig wrapper | WIRED | Line 1: `require('@sentry/nextjs')`, line 30: `module.exports = withSentryConfig(nextConfig, ...)` |
| `src/lib/sentry.test.ts` | `sentry.server.config.ts` | `import { beforeSend }` | WIRED | Line 9: `import { beforeSend } from '../../sentry.server.config'` |
| `src/app/api/webhooks/calendly/route.ts` | `src/lib/posthog-server.ts` | `import { getPostHogServer }` | WIRED | Line 11: `import { getPostHogServer } from '@/lib/posthog-server'`; booking_approved, booking_rejected, webhook_received events captured |
| `src/app/api/allowlists/[id]/entries/route.ts` | `src/lib/posthog-server.ts` | `import { getPostHogServer }` | WIRED | Line 6; add_email event with allowlistId and count |
| `src/app/api/auth/logout/route.ts` | `src/lib/posthog-server.ts` | `import { getPostHogServer }` | WIRED | Line 3; logout event in both POST and GET handlers |
| `src/app/layout.tsx` | `src/components/providers.tsx` | `import { PHProvider }` | WIRED | Line 6: `import { PHProvider } from '@/components/providers'`; rendered in JSX line 36 |
| `next.config.js` | `https://us.i.posthog.com` | rewrites() destination | WIRED | Line 24: `destination: 'https://us.i.posthog.com/:path*'` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OBS-01 | 07-02-PLAN.md | Sentry SDK installed with source map uploads and error alerts configured | SATISFIED | @sentry/nextjs installed; instrumentation.ts with onRequestError; sentry.server.config.ts with beforeSend PII scrubbing; withSentryConfig in next.config.js; Sentry env vars in env.ts |
| OBS-02 | 07-03-PLAN.md | PostHog SDK installed with key events tracked and user identification working | SATISFIED | posthog-js + posthog-node installed; PHProvider in layout; 9 D-05 events tracked; all using database user.id per D-06; /ingest proxy configured |
| OBS-03 | 07-01-PLAN.md | All console.log/error calls replaced with structured JSON logger (pino) including request ID, user ID, and action context | SATISFIED | Zero console calls remain in non-test src files; logger.ts with server-only guard; all 6 files migrated with structured objects and action fields |

All 3 requirements declared across plans are satisfied. No orphaned requirements found — REQUIREMENTS.md maps OBS-01, OBS-02, OBS-03 to Phase 7 only, all accounted for.

---

## Anti-Patterns Found

None. No stubs, placeholders, empty implementations, or TODO comments detected in any of the phase-modified files.

Notable: The `add_email` event captures a single event with `count` rather than per-email events — this is an intentional decision documented in 07-03-SUMMARY.md to avoid event volume explosion on bulk imports. Not a stub.

---

## Human Verification Required

### 1. Sentry Error Capture in Production

**Test:** Deploy to Vercel with NEXT_PUBLIC_SENTRY_DSN set. Trigger an error (e.g., call a route handler that throws). Check Sentry dashboard for the captured event.
**Expected:** Error appears in Sentry with TypeScript stack trace. No PII fields (request body, cookies, user object, IP) present on the event.
**Why human:** Sentry DSN must be configured; verifying the dashboard requires a live Sentry project.

### 2. Source Map Upload During Build

**Test:** Run a Vercel build with SENTRY_AUTH_TOKEN set. Check Sentry releases for uploaded source maps.
**Expected:** Minified stack traces in Sentry resolve to TypeScript source lines.
**Why human:** Requires a live Vercel build with SENTRY_AUTH_TOKEN configured.

### 3. PostHog Event Receipt in Dashboard

**Test:** With NEXT_PUBLIC_POSTHOG_KEY set, trigger a Calendly webhook (or use test mode). Check PostHog dashboard for the booking_approved or booking_rejected event.
**Expected:** Event appears with correct distinctId (database user ID, not email or Calendly URI), correct properties.
**Why human:** Requires PostHog project and live credentials; event receipt cannot be verified by static analysis.

### 4. PHProvider Ad-Blocker Proxy Behavior

**Test:** With an ad blocker active in a browser, load the app. Check PostHog receives pageview events (they should route via /ingest proxy instead of direct to posthog.com).
**Expected:** Pageview events are captured even with ad blocker active.
**Why human:** Browser behavior with ad blockers cannot be tested statically.

### 5. Vercel Log Queryability

**Test:** Deploy to Vercel and trigger a webhook. In Vercel log viewer, filter by JSON fields (e.g., `action:booking_approved`).
**Expected:** Logs are parsed as JSON and individual fields are filterable in the Vercel log dashboard.
**Why human:** Requires a live Vercel deployment and manual log inspection.

---

## Gaps Summary

No gaps. All must-haves verified at all three levels (exists, substantive, wired).

**Package installation confirmed:**
- `pino@^10.3.1` — dependency
- `pino-pretty@^13.1.3` — devDependency
- `@sentry/nextjs@^10.45.0` — dependency
- `posthog-js@^1.363.1` — dependency
- `posthog-node@^5.21.2` — dependency

**PII compliance confirmed:**
- All PostHog `distinctId` fields use `user.id` (database ID) or the literal string `'system'` — no emails or Calendly URIs
- Sentry `beforeSend` deletes `request.data`, `request.cookies`, `request.env.REMOTE_ADDR`, and `event.user`
- Logger calls use structured objects with IDs only; no email or token data logged

**Serverless safety confirmed:**
- PostHog singleton uses `flushAt: 1` and `flushInterval: 0`
- All server-side handlers call `await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])` before returning

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_

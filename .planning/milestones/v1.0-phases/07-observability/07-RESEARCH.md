# Phase 7: Observability - Research

**Researched:** 2026-03-21
**Domain:** Sentry error monitoring, pino structured logging, PostHog product analytics — Next.js 15 App Router
**Confidence:** HIGH — all package versions verified against npm registry; integration patterns verified against official docs and milestone-level research

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PII Scrubbing (Sentry)**
- D-01: Strip ALL user data from Sentry events — no emails, names, tokens, or IPs. Keep only error type, stack trace, and request path.
- D-02: Capture errors from ALL routes including webhook handlers (Calendly and Stripe). Webhook failures are critical — missed cancellations mean unauthorized bookings get through.

**Log Verbosity**
- D-03: Production log level defaults to `info` — log all operations (webhook received, booking outcomes, token refresh, auth events).
- D-04: Webhook payloads logged as event type + IDs only (event_type, invitee URI, event URI). No full payload data, no PII in logs.

**PostHog Event Taxonomy**
- D-05: Events tracked in this phase (snake_case naming convention):
  - `signup` — user completes Calendly OAuth
  - `add_email` — user adds email to allowlist
  - `upgrade_click` — user clicks upgrade/checkout
  - `webhook_received` — webhook endpoint hit
  - `booking_approved` — booking passes allowlist check
  - `booking_rejected` — booking fails allowlist check and is cancelled
  - `login` — user authenticates
  - `logout` — user logs out
  - `token_refresh_failed` — Calendly token refresh fails
- D-06: User identification via database user ID (Prisma auto-generated). No Calendly URI or email sent to PostHog.

### Claude's Discretion
- Sentry alert notification rules and thresholds
- Pino transport configuration and log formatting
- PostHog proxy rewrite path (`/ingest` or similar)
- Loading skeleton or error boundary design for global-error.tsx
- Exact pino log field names beyond the required (requestId, userId, action)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | Sentry SDK installed with source map uploads and error alerts configured | @sentry/nextjs 10.45.0; wizard generates instrumentation files; withSentryConfig wraps next.config.js; beforeSend scrubs PII; SENTRY_AUTH_TOKEN in Vercel Build scope |
| OBS-02 | PostHog SDK installed with key events tracked (signup, add_email, upgrade_click, webhook_received) and user identification working | posthog-js 1.363.1 (client) + posthog-node 5.28.5 (server); PHProvider in layout.tsx; posthog-server.ts singleton; /ingest proxy rewrite; flushAt:1 flushInterval:0 for serverless |
| OBS-03 | All console.log/error calls replaced with structured JSON logger (pino) including request ID, user ID, and action context | pino 10.3.1; server-only guard; serverExternalPackages in next.config.js; 43 calls across 6 files to replace |
</phase_requirements>

---

## Summary

Phase 7 adds three observability layers to the existing Protectly Next.js 15 App Router application: structured JSON logging via pino (replacing 43 console.log/error calls across 6 files), error monitoring via Sentry with PII scrubbing, and product analytics via PostHog with server-side event capture from webhook handlers. The work is purely additive infrastructure — no user-facing behavior changes.

The correct build order is: pino first (lowest risk, pure refactor, makes all subsequent phases debuggable), then Sentry (error monitoring before adding new observability surface area), then PostHog (analytics after the error safety net is in place). Each tool has a well-defined split between server-side and client-side initialization, and this split must be respected or builds break.

The single highest-risk area is the PostHog server-side client: `posthog-node` events are silently dropped in Vercel serverless functions unless `flushAt: 1, flushInterval: 0` is configured AND `await shutdown()` is called before each handler returns. The existing codebase has no console spies in tests, which means the pino migration can be done cleanly without test assertion updates.

**Primary recommendation:** Install pino + configure serverExternalPackages first, replace all 43 console calls atomically per file, then run Sentry wizard, then add PostHog client + server pair with the serverless-safe singleton pattern.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pino` | 10.3.1 | Structured JSON logger replacing console.log/error | Fastest Node.js logger (~5x faster than winston); JSON output in production is machine-parseable in Vercel logs; minimal API surface |
| `pino-pretty` | 13.1.3 | Dev-mode human-readable log output | Only used in development; zero production footprint |
| `@sentry/nextjs` | 10.45.0 | Error monitoring, source map upload, PII scrubbing | Official Next.js SDK; handles App Router, Edge runtime, RSC errors via onRequestError hook; wizard automates all three entry points |
| `posthog-js` | 1.363.1 | Browser-side product analytics | Required for client component event capture and automatic pageview tracking via PHProvider |
| `posthog-node` | 5.28.5 | Server-side event capture from Route Handlers | Required for webhook handler events (booking_approved, booking_rejected) and auth callback events; separate package from posthog-js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | built-in Next.js | Build-time guard preventing server modules from being bundled client-side | Import at top of logger.ts and posthog-server.ts; causes build error if accidentally included in a client component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pino` | `winston` | Winston has richer transports but is ~4x slower; for Vercel stdout-only logging, pino is the correct choice |
| `@sentry/nextjs` | `@sentry/node` (bare) | Bare @sentry/node misses RSC error capture via onRequestError and source map upload integration |
| `posthog-js` + `posthog-node` | `@posthog/next` | @posthog/next is version 0.1.0 (alpha) — unstable API, minimal adoption; the two-package pattern is PostHog's documented approach for Next.js |

**Installation:**
```bash
# Structured logging
npm install pino
npm install -D pino-pretty

# Error monitoring (then run wizard separately — see Pattern 2)
npm install @sentry/nextjs

# Product analytics
npm install posthog-js posthog-node
```

**Version verification:** All versions confirmed against npm registry on 2026-03-21. pino 10.3.1, pino-pretty 13.1.3, @sentry/nextjs 10.45.0, posthog-js 1.363.1, posthog-node 5.28.5.

---

## Architecture Patterns

### Recommended Project Structure

```
(project root)
├── instrumentation.ts              # Server: register() + onRequestError export
├── instrumentation-client.ts       # Browser: Sentry + PostHog init
├── sentry.server.config.ts         # Sentry server DSN, beforeSend scrubbing
├── sentry.edge.config.ts           # Sentry edge runtime (thin)
src/
├── app/
│   ├── global-error.tsx            # Required React error boundary for Sentry
│   └── (existing routes — modified to use logger + PostHog)
├── components/
│   └── providers.tsx               # PostHogProvider client wrapper ('use client')
└── lib/
    ├── logger.ts                   # pino singleton, server-only
    └── posthog-server.ts           # posthog-node singleton for server events
```

New files required: 7 (instrumentation.ts, instrumentation-client.ts, sentry.server.config.ts, sentry.edge.config.ts, src/app/global-error.tsx, src/components/providers.tsx, src/lib/posthog-server.ts, src/lib/logger.ts)

Modified files: next.config.js (withSentryConfig + serverExternalPackages), src/env.ts (new env vars), src/app/layout.tsx (PHProvider wrapper), 6 files replacing console.log calls

### Pattern 1: Pino Singleton with server-only Guard

**What:** `src/lib/logger.ts` exports a pino instance configured for JSON in production and pretty-printed output in development. The `'server-only'` import causes a build error if the module is accidentally imported in a client component.

**When to use:** Every server-side file that currently uses console.log/error. Never use in middleware (Edge Runtime) — use `console.log(JSON.stringify({...}))` there if needed.

**Example:**
```typescript
// src/lib/logger.ts
// Source: official pino docs + .planning/research/STACK.md
import 'server-only'
import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
})
```

Usage pattern for webhook handlers (D-04 compliant — IDs only, no PII):
```typescript
// Replace: console.log('[Calendly Webhook] event received', payload)
// With:
logger.info({ eventType: payload.event, inviteeUri: payload.payload.invitee.uri }, 'webhook received')

// Replace: console.error('[Calendly Webhook] Error processing', error)
// With:
logger.error({ err: error, userId, action: 'process_webhook' }, 'webhook processing failed')
```

### Pattern 2: Sentry Setup via Wizard

**What:** The Sentry wizard generates all required files automatically. Do not hand-roll these files.

**When to use:** Run once at the start of plan 07-02.

```bash
npx @sentry/wizard@latest -i nextjs
```

This generates: `instrumentation.ts`, `sentry.client.config.ts` (rename to `instrumentation-client.ts` for Next.js 15 style), `sentry.server.config.ts`, `sentry.edge.config.ts`, and wraps `next.config.js` with `withSentryConfig`.

**Critical: onRequestError hook** — must be present in instrumentation.ts for RSC error capture:
```typescript
// instrumentation.ts
// Source: Sentry Next.js docs + .planning/research/ARCHITECTURE.md
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Required for React Server Component error capture — @sentry/nextjs >= 8.28.0
export const onRequestError = Sentry.captureRequestError
```

**Critical: beforeSend PII scrubbing** (D-01 — strip ALL user data):
```typescript
// sentry.server.config.ts
// Source: Sentry sensitive data docs
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip request body (contains Calendly/Stripe webhook payloads with PII)
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      // Remove IP — keep only path and method
      if (event.request.env) {
        delete event.request.env['REMOTE_ADDR']
      }
    }
    // Remove user context entirely
    delete event.user
    return event
  },
})
```

### Pattern 3: PostHog Client/Server Split

**What:** Two completely separate SDKs. `posthog-js` runs only in browser Client Components. `posthog-node` runs only in server-side Route Handlers and Server Actions. They must NEVER be mixed.

**Client side (browser):**
```typescript
// src/components/providers.tsx
// Source: PostHog Next.js docs
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false, // Handle manually via usePathname
      capture_pageleave: true,
    })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
```

Wrap in layout.tsx (PHProvider stays in its own file — do not add 'use client' to layout.tsx):
```typescript
// src/app/layout.tsx — MODIFY
import { PHProvider } from '@/components/providers'
// ...
<QueryProvider>
  <PHProvider>
    {children}
    <Toaster />
  </PHProvider>
</QueryProvider>
```

**Server side (Route Handlers/webhooks) — D-06 compliant:**
```typescript
// src/lib/posthog-server.ts
// Source: PostHog Node.js docs + .planning/research/ARCHITECTURE.md
import 'server-only'
import { PostHog } from 'posthog-node'

let _posthog: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: 'https://us.i.posthog.com',
      flushAt: 1,       // flush immediately — serverless terminates fast
      flushInterval: 0, // no batching timer
    })
  }
  return _posthog
}
```

Usage in webhook handlers:
```typescript
// Always await shutdown() before returning — CRITICAL in serverless
const ph = getPostHogServer()
ph.capture({
  distinctId: userId,  // D-06: database user ID only
  event: 'booking_approved',
  properties: { source: 'calendly_webhook' },
})
await ph.shutdown()
```

**PostHog proxy rewrite** (add to next.config.js to avoid ad blockers):
```javascript
async rewrites() {
  return [
    {
      source: '/ingest/static/:path*',
      destination: 'https://us-assets.i.posthog.com/static/:path*',
    },
    {
      source: '/ingest/:path*',
      destination: 'https://us.i.posthog.com/:path*',
    },
  ]
},
```

### Pattern 4: next.config.js Modifications

Both pino (serverExternalPackages) and Sentry (withSentryConfig) require next.config.js changes. Current file uses `module.exports = nextConfig` (CommonJS). Apply in this order: add serverExternalPackages first, then wrap with withSentryConfig.

```javascript
// next.config.js — final state
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pino', 'pino-pretty'],
  images: {
    remotePatterns: [/* existing */],
  },
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
})
```

### Anti-Patterns to Avoid

- **Pino in middleware:** `middleware.ts` runs on Edge Runtime; pino Worker Threads do not exist there. Use bare `console.log(JSON.stringify({...}))` in middleware if structured output is needed.
- **PostHog without shutdown():** Omitting `await ph.shutdown()` in serverless causes silent event loss. Set `flushAt: 1` AND call shutdown — both are required.
- **SENTRY_AUTH_TOKEN as runtime env:** Set as Build-scope-only in Vercel dashboard. It should never be available to running functions.
- **PHProvider in layout.tsx directly:** Creates a client boundary at the layout level. Keep PHProvider in `src/components/providers.tsx` with `'use client'`; import it from layout.tsx which stays as a Server Component.
- **Partial console.log migration:** Replace all calls in a file atomically; mixed `console.log` + `logger.info` in the same file is never acceptable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error monitoring with stack traces | Custom error handler + logging | `@sentry/nextjs` | Source map upload, RSC error capture via onRequestError hook, PII scrubbing API, release tracking — weeks of work |
| Structured log formatting | Custom JSON serializer | `pino` | Child loggers, log levels, async-safe streaming, fast serialization — already solved |
| Dev-mode pretty logs | Custom colorizer | `pino-pretty` (devDependency) | Already exists; conditional transport pattern handles dev/prod split |
| Server-side analytics flush in serverless | Custom HTTP client with timeout | `posthog-node` with `flushAt: 1` | Batching, retry logic, and serverless flush semantics are built in |
| Ad-blocker bypass for analytics | Custom proxy middleware | Next.js `rewrites()` pointing to `/ingest` | One-time config; PostHog provides the canonical destination URLs |

**Key insight:** All three tools (Sentry, pino, PostHog) have explicit Next.js App Router documentation. Following their documented patterns is faster and more correct than any custom implementation.

---

## Common Pitfalls

### Pitfall 1: onRequestError Hook Missing — RSC Errors Never Reach Sentry

**What goes wrong:** Sentry is installed and seems to work for Route Handler errors, but errors thrown inside React Server Components are silently swallowed. The Sentry dashboard shows nothing despite pages crashing.

**Why it happens:** The `onRequestError` export in `instrumentation.ts` is the only mechanism for capturing RSC errors in Next.js 15. It requires `@sentry/nextjs` >= 8.28.0. Most tutorials predate this requirement.

**How to avoid:** Ensure `instrumentation.ts` exports `onRequestError = Sentry.captureRequestError`. Verify by throwing a deliberate error in a Server Component on a preview deployment and confirming it appears in Sentry within 60 seconds (success criterion 1).

**Warning signs:** Sentry version below 8.28.0; instrumentation.ts missing `onRequestError` export.

### Pitfall 2: Source Maps Missing — Stack Traces Are Unreadable

**What goes wrong:** Sentry errors show minified code (`a.b.c is not a function` with no file or line). The build succeeds but source maps are not uploaded because `SENTRY_AUTH_TOKEN` is absent from Vercel environment variables.

**Why it happens:** Token works locally in `.env.local`; developers forget to add it to Vercel. The Sentry webpack plugin does not fail the build — it only logs a warning buried in build output.

**How to avoid:** Add `SENTRY_AUTH_TOKEN` to Vercel project settings (Build scope only). Verify in a preview deployment that a triggered error shows the correct TypeScript file and line number (success criterion 5).

**Warning signs:** Stack traces show minified code; `SENTRY_AUTH_TOKEN` absent from Vercel dashboard.

### Pitfall 3: Sentry Captures PII from Webhook Payloads

**What goes wrong:** Calendly webhook payloads contain invitee email, name, and event details. A webhook processing error causes Sentry to capture the full request body as event context. PII is transmitted to Sentry's US-hosted cloud.

**Why it happens:** Default Sentry behavior captures everything available. `beforeSend` scrubbing is not configured because it "works without it."

**How to avoid:** Configure `beforeSend` in `sentry.server.config.ts` to delete `event.request.data`, `event.request.cookies`, and `event.user` before transmission. This is D-01 and success criterion 4 — must be in place before first production deploy. Verify by intentionally triggering a webhook error and inspecting the Sentry event.

### Pitfall 4: PostHog Server Events Silently Dropped

**What goes wrong:** `booking_approved` and `booking_rejected` events never appear in PostHog Live Events. Works in development (persistent process), fails silently in production (serverless termination before async flush completes).

**Why it happens:** Default `posthog-node` settings (`flushAt: 20, flushInterval: 10000`) were designed for long-running servers. Vercel functions freeze immediately after response.

**How to avoid:** Configure `posthog-node` with `flushAt: 1, flushInterval: 0`. Always call `await getPostHogServer().shutdown()` before returning from any route handler that calls `capture()`. Verify success criterion 3 (booking webhook event visible in PostHog Live Events within seconds).

**Warning signs:** Server-side events appear in dev but not production; no `await shutdown()` visible after `capture()` calls.

### Pitfall 5: Pino Breaks Edge Runtime or Gets Bundled Client-Side

**What goes wrong:** Two distinct failures: (1) `TypeError: pino.transport is not a function` in Vercel Edge function logs; (2) Build error mentioning `fs` or `worker_threads` in browser bundle.

**Why it happens:** Pino uses Node.js Worker Threads internally. Edge Runtime does not support them. Without `serverExternalPackages`, Next.js tries to bundle pino for the client.

**How to avoid:** Add `serverExternalPackages: ['pino', 'pino-pretty']` to next.config.js. Add `import 'server-only'` to `src/lib/logger.ts`. Never use pino in middleware.ts.

**Warning signs:** `pino-pretty` in production `dependencies` (should be `devDependencies`); logger.ts missing `'server-only'` guard.

### Pitfall 6: Console Spy Assertions Silently Break (or Vacuously Pass)

**What goes wrong:** Tests that asserted on `console.error` spy behavior either stop catching errors (spy fires on nothing) or pass vacuously (spy was asserting "not called" and that's now trivially true).

**How to avoid:** Audit test files before migration: `grep -r "spyOn(console" src/`. **Current finding: no console spies exist in the Protectly test suite.** The migration can proceed without test assertion updates. Verify with `grep -r "console\.log\|console\.error\|console\.warn" src/app src/lib` after migration — must return zero results.

---

## Code Examples

Verified patterns from official sources and milestone-level research:

### Logger Usage in Webhook Handler (D-03, D-04 Compliant)

```typescript
// Source: .planning/research/ARCHITECTURE.md + .planning/research/STACK.md
import { logger } from '@/lib/logger'

// Replace: console.log('[Calendly Webhook] Received event', event.event)
logger.info({ eventType: event.event, inviteeUri: event.payload?.invitee?.uri }, 'webhook received')

// Replace: console.log('[Calendly Webhook] APPROVED booking for', inviteeEmail)
logger.info({ userId, action: 'booking_approved', eventUri }, 'booking approved')

// Replace: console.error('[Calendly Webhook] Error', error)
logger.error({ err: error, userId, action: 'process_webhook' }, 'webhook processing failed')
```

### PostHog Server Event Tracking (D-05, D-06 Compliant)

```typescript
// Source: .planning/research/ARCHITECTURE.md
import { getPostHogServer } from '@/lib/posthog-server'

// In webhook handler — booking_approved event
const ph = getPostHogServer()
ph.capture({
  distinctId: userId,           // D-06: DB user ID only — no Calendly URI or email
  event: 'booking_approved',
  properties: {
    source: 'calendly_webhook',
  },
})
await ph.shutdown()             // REQUIRED in serverless — prevents silent event loss

// In auth callback — signup event
ph.capture({ distinctId: userId, event: 'signup' })
await ph.shutdown()
```

### Sentry beforeSend Scrubbing (D-01 Compliant)

```typescript
// Source: Sentry sensitive data docs
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data     // removes webhook payload body
      delete event.request.cookies  // removes session cookies
      if (event.request.env) {
        delete event.request.env['REMOTE_ADDR']  // removes IP
      }
    }
    delete event.user               // removes any user context
    return event
  },
})
```

### global-error.tsx (Required by Sentry for App Router)

```typescript
// src/app/global-error.tsx
// Source: Sentry Next.js manual setup docs
'use client'
import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
```

### New Environment Variables for src/env.ts

```typescript
// Add to server section of createEnv()
NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
SENTRY_AUTH_TOKEN: z.string().optional(), // Build-time only

// Add to client section
NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),

// Add to server section (same key as NEXT_PUBLIC, different variable for clarity)
POSTHOG_KEY: z.string().min(1),
```

---

## Existing Codebase State

### Files Requiring console.log Replacement (OBS-03)

Confirmed by live codebase scan on 2026-03-21:

| File | Call Count | Primary Purpose |
|------|-----------|-----------------|
| `src/app/api/webhooks/calendly/route.ts` | 25 | Booking approval, rejection, webhook processing |
| `src/app/api/auth/calendly/callback/route.ts` | 9 | OAuth flow, token storage |
| `src/app/api/webhooks/stripe/route.ts` | 3 | Stripe event handling |
| `src/lib/calendly.ts` | 4 | Calendly API utilities |
| `src/app/api/billing/checkout/route.ts` | 1 | Stripe checkout session creation |
| `src/app/api/billing/portal/route.ts` | 1 | Stripe portal redirect |
| **Total** | **43** | |

**Key finding:** No console spy assertions exist in any test file. The migration can proceed without updating test assertions. Verify post-migration with `grep -r "console\." src/app src/lib`.

### Test Infrastructure (existing)

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.16 |
| Config file | `vitest.config.ts` (project root) |
| Setup file | `src/test/setup.ts` |
| Quick run | `npx vitest run` |
| Full suite | `npx vitest run --coverage` |

Existing test files that cover modified code:
- `src/app/api/webhooks/calendly/route.test.ts` — will need logger mock added
- `src/app/api/webhooks/stripe/route.test.ts` — will need logger mock added

### Modified Config Files

- `next.config.js` — currently CommonJS `module.exports = nextConfig`; must add `serverExternalPackages`, `rewrites()` for PostHog proxy, and `withSentryConfig` wrapper
- `vercel.json` — currently has `"crons": []` (empty); Phase 7 does not add crons (that is Phase 10)
- `src/app/layout.tsx` — wraps children in `<QueryProvider>`; PHProvider wraps inside that

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `serverComponentsExternalPackages` | `serverExternalPackages` (Next.js 15 rename) | Use the new key; old key still works but is deprecated |
| Sentry `sentry.client.config.ts` as separate file | `instrumentation-client.ts` (Next.js 15 style) | Wizard may generate old-style name; either works but instrumentation-client.ts aligns with Next.js 15 documentation |
| PostHog `capture_pageview: true` | `capture_pageview: false` + manual `usePathname` listener | Required for SPA navigation in App Router; auto-capture misses client-side navigations |
| `@sentry/nextjs` < 8.28.0 | `@sentry/nextjs` >= 8.28.0 (current: 10.45.0) | `onRequestError` for RSC capture only available 8.28.0+ |

**Deprecated/outdated:**
- `@posthog/next`: Do not use — version 0.1.0 alpha, unstable API. Use `posthog-js` + `posthog-node` pair.
- Turbopack source maps with current next@15.1.3: The project is on Next.js 15.1.3; Turbopack source map upload requires 15.4.1+. Use webpack (default at 15.1.3). No action needed — webpack upload is fully supported.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.16 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-03 | logger.ts exports pino instance with correct config | unit | `npx vitest run src/lib/logger.test.ts` | ❌ Wave 0 |
| OBS-03 | calendly webhook handler uses logger not console | unit | `npx vitest run src/app/api/webhooks/calendly/route.test.ts` | ✅ (needs logger mock) |
| OBS-03 | no console.log/error in src/ after migration | lint/grep | `grep -r "console\." src/app src/lib` → zero results | manual |
| OBS-01 | Sentry instrumentation.ts exports onRequestError | unit | `npx vitest run src/lib/sentry.test.ts` | ❌ Wave 0 |
| OBS-01 | beforeSend strips request body and user context | unit | `npx vitest run src/lib/sentry.test.ts` | ❌ Wave 0 |
| OBS-02 | posthog-server.ts returns configured PostHog instance | unit | `npx vitest run src/lib/posthog-server.test.ts` | ❌ Wave 0 |
| OBS-02 | booking_approved event captured with correct userId | unit | `npx vitest run src/app/api/webhooks/calendly/route.test.ts` | ✅ (needs PostHog mock) |
| OBS-01, OBS-02, OBS-03 (integration) | error in RSC appears in Sentry; booking event in PostHog | manual | Preview deployment smoke test | manual |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/logger.test.ts` — covers OBS-03 (logger config, level, output format)
- [ ] `src/lib/posthog-server.test.ts` — covers OBS-02 (singleton, flushAt:1, flushInterval:0)
- [ ] `src/lib/sentry.test.ts` — covers OBS-01 (beforeSend scrubbing, user/request data removed)
- [ ] Logger mock in `src/app/api/webhooks/calendly/route.test.ts` — `vi.mock('@/lib/logger')` added to existing test
- [ ] Logger mock in `src/app/api/webhooks/stripe/route.test.ts` — same pattern

---

## Open Questions

1. **PostHog pageview tracking for App Router SPA navigation**
   - What we know: `capture_pageview: false` is correct; manual listener on `usePathname` is the documented pattern for Next.js App Router
   - What's unclear: Whether this phase should add the full pageview listener in PHProvider or defer it — success criteria do not require pageview tracking verification
   - Recommendation: Add a basic `usePathname` + `useEffect` pageview listener in PHProvider during plan 07-03; it is low-effort and part of standard PHProvider setup

2. **posthog.shutdown() hang risk (noted in STATE.md)**
   - What we know: STATE.md flags that `posthog.shutdown()` can hang in some edge environments
   - What's unclear: Whether this is an Edge Runtime issue (route handlers run in Node.js runtime, not Edge)
   - Recommendation: Wrap `await ph.shutdown()` in `Promise.race([ph.shutdown(), new Promise(r => setTimeout(r, 2000))])` if observed in preview deployment testing; add this as a verification step in plan 07-03

3. **Sentry tracesSampleRate in production**
   - What we know: Setting to 1.0 in development is fine; production should be lower to manage quota
   - What's unclear: Whether Sentry free tier (5K errors/mo) would be exceeded at Protectly's current traffic
   - Recommendation: Set `tracesSampleRate: 0.1` in production config (Claude's discretion per CONTEXT.md)

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — all package versions confirmed against npm registry 2026-03-21
- `.planning/research/ARCHITECTURE.md` — integration patterns, component map, code examples
- `.planning/research/PITFALLS.md` — pitfall catalogue with official doc citations
- [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) — instrumentation setup, withSentryConfig, onRequestError
- [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js) — client/server split, PHProvider, flushAt/flushInterval
- [PostHog Node.js docs](https://posthog.com/docs/libraries/node) — serverless configuration
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — vercel.json schema
- npm registry — @sentry/nextjs@10.45.0, posthog-js@1.363.1, posthog-node@5.28.5, pino@10.3.1, pino-pretty@13.1.3 (confirmed 2026-03-21)

### Secondary (MEDIUM confidence)

- [Arcjet structured logging guide](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — `serverExternalPackages` config for pino
- [Sentry onRequestError GitHub discussion](https://github.com/getsentry/sentry-javascript/discussions/13442) — RSC error capture requirements
- [Pino Edge Runtime GitHub discussion](https://github.com/vercel/next.js/discussions/67213) — Edge Runtime incompatibility confirmation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed against npm registry
- Architecture: HIGH — patterns verified against official docs and milestone-level research
- Pitfalls: HIGH — verified against official docs and GitHub issues; one (shutdown hang) flagged as MEDIUM per STATE.md observation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (pino/PostHog/Sentry release frequently; re-verify versions if planning is delayed more than 30 days)

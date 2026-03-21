# Architecture Research

**Domain:** Production Infrastructure Additions — Observability, Email, and Trial Management
**Researched:** 2026-03-21
**Confidence:** HIGH

## Context: What Already Exists

This is a subsequent milestone. The existing architecture is:

```
┌──────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 15)                        │
├──────────────────────────────────────────────────────────────┤
│  App Router                                                   │
│  ┌──────────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ /api/webhooks    │  │  /api/auth  │  │  /api/billing   │  │
│  │  (Calendly,      │  │ (iron-sess) │  │  (Stripe)       │  │
│  │   Stripe)        │  └─────────────┘  └─────────────────┘  │
│  └──────────────────┘                                         │
├──────────────────────────────────────────────────────────────┤
│  src/lib/                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │  prisma  │  │ calendly │  │encryption │  │  session   │  │
│  │  stripe  │  │  webhook │  │guest-check│  │  utils     │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Cross-cutting                                                │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  env.ts  │  │  middleware   │  │  Zod env validation  │  │
│  │  (Zod)   │  │ (Upstash RL)  │  │  at startup          │  │
│  └──────────┘  └───────────────┘  └──────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  External                                                     │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────┐  │
│  │PostgreSQL│  │  Upstash  │  │  Calendly  │  │  Stripe  │  │
│  │(Railway) │  │   Redis   │  │   OAuth    │  │  Billing │  │
│  └──────────┘  └───────────┘  └────────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Target Architecture: New Components Added

```
┌──────────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 15)                        │
├──────────────────────────────────────────────────────────────┤
│  Instrumentation Layer  (NEW)                                 │
│  ┌──────────────────────────┐  ┌────────────────────────────┐ │
│  │  instrumentation.ts      │  │ instrumentation-client.ts  │ │
│  │  register(): Sentry      │  │ Sentry browser init        │ │
│  │  server init             │  │ PostHog client init        │ │
│  │  onRequestError hook     │  │                            │ │
│  └──────────────────────────┘  └────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  App Router                                                   │
│  ┌──────────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ /api/webhooks    │  │  /api/auth  │  │  /api/billing   │  │
│  │  (MODIFIED:      │  │ (unchanged) │  │  (unchanged)    │  │
│  │   logger +       │  └─────────────┘  └─────────────────┘  │
│  │   emails +       │                                         │
│  │   PostHog events)│                                         │
│  └──────────────────┘                                         │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │  /api/cron/      │  │  /api/settings/email-preferences │   │
│  │  trial-expiry    │  │  GET + PATCH                     │   │
│  │  (NEW)           │  │  (NEW)                           │   │
│  └──────────────────┘  └──────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  src/lib/  (existing + new)                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │  prisma  │  │ calendly │  │encryption │  │  session   │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────┐  │
│  │ logger   │  │  email   │  │    posthog-server          │  │
│  │  (NEW)   │  │  (NEW)   │  │    (NEW)                   │  │
│  └──────────┘  └──────────┘  └───────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  Prisma schema additions                                      │
│  User: + emailApprovedBookings Boolean @default(true)         │
│        + emailRejectedBookings Boolean @default(true)         │
│        + emailTrialWarnings    Boolean @default(true)         │
├──────────────────────────────────────────────────────────────┤
│  External  (new)                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐                  │
│  │  Sentry  │  │ PostHog  │  │   Resend   │                  │
│  │  (error  │  │(analytics│  │  (email    │                  │
│  │  monitor)│  │+ pageview│  │  sending)  │                  │
│  └──────────┘  └──────────┘  └────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Status | Responsibility | Location |
|-----------|--------|----------------|----------|
| `instrumentation.ts` | NEW | Server-side Sentry init via `register()`; exports `onRequestError = Sentry.captureRequestError` | project root |
| `instrumentation-client.ts` | NEW | Browser Sentry init; PostHog `posthog.init()` | project root |
| `sentry.server.config.ts` | NEW | Sentry DSN, release, tracesSampleRate, server options | project root |
| `sentry.edge.config.ts` | NEW | Sentry edge runtime options (thin; re-use server DSN) | project root |
| `src/app/global-error.tsx` | NEW | React error boundary for App Router; required by Sentry | src/app/ |
| `src/lib/logger.ts` | NEW | pino singleton — JSON in production, pretty in dev. Add `'server-only'` import guard. | src/lib/ |
| `src/lib/email.ts` | NEW | Resend client singleton; `sendEmail()` utility; React Email template exports | src/lib/ |
| `src/lib/posthog-server.ts` | NEW | posthog-node singleton (`flushAt: 1`, `flushInterval: 0`) for server-side event capture | src/lib/ |
| `src/app/api/cron/trial-expiry/route.ts` | NEW | GET handler — CRON_SECRET auth guard; find expired/expiring trials; downgrade to FREE; send warning emails | src/app/api/ |
| `src/app/api/settings/email-preferences/route.ts` | NEW | GET + PATCH — authenticated; read/update user email preference flags | src/app/api/ |
| `src/components/providers.tsx` | NEW | Client component wrapping app in `PostHogProvider`; handles pageview tracking | src/components/ |
| `next.config.js` | MODIFY | Wrap export with `withSentryConfig(nextConfig, sentryOptions)` | project root |
| `src/env.ts` | MODIFY | Add SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, RESEND_API_KEY, CRON_SECRET | src/ |
| `prisma/schema.prisma` | MODIFY | Add three email preference boolean fields to User model | prisma/ |
| `vercel.json` | MODIFY | Populate `"crons"` array — currently `"crons": []` | project root |
| Calendly webhook route | MODIFY | Replace `console.log/error` with `logger.*`; add conditional email sends; add PostHog event capture | existing |
| Stripe webhook route | MODIFY | Replace `console.log/error` with `logger.*` | existing |

## Recommended Project Structure (New Files Only)

```
(project root)
├── instrumentation.ts            # Server: register() + onRequestError
├── instrumentation-client.ts     # Browser: Sentry + PostHog init
├── sentry.server.config.ts       # Sentry server DSN/options
├── sentry.edge.config.ts         # Sentry edge runtime (thin)
src/
├── app/
│   ├── global-error.tsx          # React error boundary (required by Sentry)
│   └── api/
│       ├── cron/
│       │   └── trial-expiry/
│       │       └── route.ts      # GET — CRON_SECRET bearer guard
│       └── settings/
│           └── email-preferences/
│               └── route.ts      # GET + PATCH — user preferences
├── components/
│   └── providers.tsx             # PostHogProvider client wrapper
└── lib/
    ├── logger.ts                 # pino singleton, server-only
    ├── email.ts                  # Resend singleton + sendEmail() + templates
    └── posthog-server.ts         # posthog-node singleton for server events
```

### Structure Rationale

- **instrumentation*.ts at project root:** Next.js requires these files at the root (or `src/` if the project uses `src/`). This project has `src/` for app code but root-level config files — keep instrumentation at root consistent with `next.config.js`, `middleware.ts`, `vercel.json`.
- **src/lib/ for singletons:** Mirrors the existing pattern (`prisma.ts`, `stripe.ts`, `calendly.ts`). Each external service client lives in its own lib file and is imported wherever needed.
- **src/app/api/cron/ namespace:** Keeps scheduled task routes clearly separated from user-facing API routes. CRON_SECRET guard makes it obvious these are not user-callable.

## Architectural Patterns

### Pattern 1: Next.js 15 Instrumentation File Split

**What:** Next.js 15 provides two instrumentation entry points. `instrumentation.ts` fires server-side before the first request handler and is used to register Sentry server/edge SDKs. `instrumentation-client.ts` fires browser-side before the first React render and is used to initialize Sentry browser SDK and PostHog.

**When to use:** Required for any observability SDK that must activate before the first request. Both Sentry and PostHog rely on this.

**Trade-offs:** The split cleanly separates Node.js-only code (server SDK) from browser-safe code. The `onRequestError` export on `instrumentation.ts` is the only way to catch React Server Component errors in Next.js 15 — it must be present.

**Example:**
```typescript
// instrumentation.ts
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors from RSC, middleware, proxies — requires @sentry/nextjs >=8.28.0
export const onRequestError = Sentry.captureRequestError
```

```typescript
// instrumentation-client.ts
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { env } from '@/env'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
})

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: '/ingest',        // proxy through Next.js to avoid ad blockers
  ui_host: 'https://us.posthog.com',
  capture_pageview: false,    // PHProvider handles pageviews manually
})
```

### Pattern 2: Singleton Lib Modules for External Clients

**What:** Each external service SDK gets a `src/lib/*.ts` file that constructs a lazy-initialized singleton and exports it. All callers import the singleton — never construct their own instance.

**When to use:** Any SDK that maintains state, connection pools, or batched send queues: Prisma, posthog-node, Resend. This pattern already exists in the codebase (`src/lib/prisma.ts`, `src/lib/stripe.ts`).

**Trade-offs:** Zero overhead. Prevents multiple connections. Hot module replacement in Next.js dev re-requires modules, which can reset the singleton — Next.js handles this correctly for its module cache.

**Example:**
```typescript
// src/lib/posthog-server.ts
import { PostHog } from 'posthog-node'

let _posthog: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: 'https://us.i.posthog.com',
      flushAt: 1,          // flush immediately per event — serverless functions terminate fast
      flushInterval: 0,
    })
  }
  return _posthog
}
```

```typescript
// src/lib/email.ts
import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendEmail(opts: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  const { error } = await resend.emails.send({
    from: 'Protectly <noreply@mail.yourdomain.com>',
    ...opts,
  })
  if (error) throw new Error(`Email delivery failed: ${error.message}`)
}
```

### Pattern 3: Vercel Cron with CRON_SECRET Bearer Guard

**What:** Vercel Cron triggers an HTTP GET to a route in `vercel.json`. The route immediately checks `Authorization: Bearer <CRON_SECRET>` and returns 401 if it does not match. A Redis distributed lock (Upstash — already available) prevents double execution if two invocations overlap.

**When to use:** Any scheduled background task: trial expiry checks, email digests, cleanup jobs.

**Trade-offs:** Hobby Vercel plan limits crons to once per day with up to 59-minute scheduling imprecision. For trial expiry (1-day and 3-day granularity), once-per-day is sufficient. Vercel does not retry failed cron invocations — idempotent logic is mandatory.

**Example:**
```typescript
// src/app/api/cron/trial-expiry/route.ts
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // acquire Upstash lock, run trial expiry logic, release lock
  return Response.json({ success: true })
}
```

```json
// vercel.json addition
{
  "crons": [
    {
      "path": "/api/cron/trial-expiry",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Pattern 4: Structured Logger as console Replacement

**What:** `src/lib/logger.ts` exports a `logger` object with `info`, `warn`, `error`, `debug` methods. In production, output is newline-delimited JSON (machine-readable, searchable in Vercel logs). In development, output is colorized human-readable text. All server-side files replace `console.log/error` with `logger.*`.

**When to use:** All server-side files. The `'server-only'` import guard prevents accidental client bundle inclusion.

**Trade-offs:** pino is the fastest Node.js logger (~5x faster than winston). Structured fields (`userId`, `inviteeEmail`, `eventType`) become searchable in Vercel's log dashboard. No external log service needed — Vercel captures stdout.

**Example:**
```typescript
// src/lib/logger.ts
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

Usage replaces existing `console.log('[Calendly Webhook] Booking APPROVED ...')` patterns:
```typescript
logger.info({ userId, inviteeEmail, status: 'approved' }, 'booking processed')
```

## Data Flow

### Booking Webhook Flow (Modified)

```
Calendly → POST /api/webhooks/calendly
                │
                ├── logger.info({ inviteeEmail }, 'webhook received')
                │
                ├── [existing: signature verify, timestamp check, idempotency]
                │
                ├── [existing: allowlist check, guest mode evaluation]
                │
                ├── prisma.bookingAttempt.create(...)
                │
                ├── posthogServer.capture({ event: 'booking_processed',
                │     distinctId: userId, properties: { status, guestMode } })
                │   └── await posthogServer.shutdown()
                │
                ├── [if REJECTED and user.emailRejectedBookings === true]
                │   └── sendEmail({ template: BookingRejected, to: user.email })
                │       wrapped in try/catch — email failure DOES NOT fail webhook
                │
                └── [if APPROVED and user.emailApprovedBookings === true]
                    └── sendEmail({ template: BookingApproved, to: user.email })
                        wrapped in try/catch — same rule
```

### Trial Expiry Cron Flow (New)

```
Vercel Cron (09:00 UTC daily) → GET /api/cron/trial-expiry
                                       │
                                       ├── verify Authorization: Bearer CRON_SECRET → 401 if mismatch
                                       │
                                       ├── acquire Upstash Redis lock
                                       │   └── return early if lock held (concurrent run guard)
                                       │
                                       ├── prisma.user.findMany({
                                       │     where: { subscriptionStatus: 'TRIALING',
                                       │              trialEndsAt: { lt: now } }
                                       │   })
                                       │   └── for each: update tier=FREE, status=ACTIVE
                                       │   └── if emailTrialWarnings: sendEmail(TrialExpired)
                                       │
                                       ├── prisma.user.findMany({ trialEndsAt within 1 day })
                                       │   └── if emailTrialWarnings: sendEmail(TrialExpiry1Day)
                                       │
                                       ├── prisma.user.findMany({ trialEndsAt within 3 days })
                                       │   └── if emailTrialWarnings: sendEmail(TrialExpiry3Days)
                                       │
                                       ├── logger.info({ expired, warned1d, warned3d }, 'trial cron done')
                                       │
                                       └── release Redis lock
```

### Error Capture Flow (New — Sentry)

```
Server-side error thrown (any route, RSC, middleware)
    │
    └── instrumentation.ts onRequestError → Sentry.captureRequestError
        (covers: API route throws, RSC render errors, middleware errors)

Unhandled client-side error
    └── global-error.tsx boundary → Sentry.captureException(error)

Client-side navigation / render error
    └── instrumentation-client.ts Sentry browser SDK catches automatically
```

### PostHog Analytics Flow (New)

```
Browser pageview or user action
    └── posthog.capture('event') via PostHogProvider context
        └── proxied through Next.js /ingest route → PostHog
            (proxy avoids ad blockers; NEXT_PUBLIC_POSTHOG_KEY stays hidden)

Server-side event (webhook handler, cron)
    └── getPostHogServer().capture({ distinctId: userId, event })
        └── await getPostHogServer().shutdown()  ← required in serverless
```

## Integration Points

### New External Services

| Service | SDK | Integration Method | Key Notes |
|---------|-----|--------------------|-----------|
| Sentry | `@sentry/nextjs` | `withSentryConfig(nextConfig)` in next.config.js + instrumentation files | SENTRY_AUTH_TOKEN is build-time only — set as Build scope only in Vercel, not runtime. Source maps auto-uploaded during `next build`. |
| PostHog | `posthog-js` (client) + `posthog-node` (server) | `PHProvider` in layout.tsx (client); `getPostHogServer()` singleton (server) | Proxy via `/ingest` Next.js rewrites to avoid ad-blocker interference. Both SDKs use the same NEXT_PUBLIC_POSTHOG_KEY. |
| Resend | `resend` | Singleton in `src/lib/email.ts`; React Email components for templates | Domain verification required before sending to real addresses. Free tier: 3,000 emails/month, 100/day. |
| Vercel Cron | none (HTTP) | `vercel.json` crons array + API route with CRON_SECRET guard | Hobby plan: once/day max, +/-59 min precision. Re-uses existing Upstash Redis for lock. |

### New Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Calendly webhook → `email.ts` | Direct function call, fire-and-forget | Wrap in try/catch; email failure must not fail the webhook 200 response |
| Calendly webhook → `posthog-server.ts` | Direct call + `await shutdown()` | Must flush before returning or event is lost in serverless |
| Cron route → Prisma | Direct query | Trial downgrade must be idempotent — check `subscriptionStatus` before writing |
| Cron route → `email.ts` | Direct call per user | Batch: log individual failures, continue the run |
| Cron route → Upstash Redis | Distributed lock | Re-uses existing `@upstash/redis` client from middleware |
| `logger.ts` | Server-only module import | `'server-only'` guard causes build-time error if imported in client component |

### Modified Existing Components

| Component | Change | Reason |
|-----------|--------|--------|
| `src/app/api/webhooks/calendly/route.ts` | Replace all `console.log/error` with `logger.*`; add email sends after BookingAttempt write; add PostHog capture | Structured logging + booking notifications |
| `src/app/api/webhooks/stripe/route.ts` | Replace `console.log/error` with `logger.*` | Structured logging consistency |
| `src/app/layout.tsx` | Wrap children with `<PHProvider>` client component | PostHog pageview tracking |
| `next.config.js` | Wrap export with `withSentryConfig(nextConfig, { org, project, authToken })` | Sentry webpack plugin + source map upload |
| `src/env.ts` | Add SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, RESEND_API_KEY, CRON_SECRET to schema + runtimeEnv | Fail-fast startup validation |
| `prisma/schema.prisma` | Add three email preference boolean fields to User model | Email notification preferences |
| `vercel.json` | Populate `"crons": []` with trial-expiry entry | Currently empty array |

## Schema Additions

Three boolean fields added to the User model for email notification preferences:

```prisma
// Addition to User model in prisma/schema.prisma
emailApprovedBookings  Boolean  @default(true)
emailRejectedBookings  Boolean  @default(true)
emailTrialWarnings     Boolean  @default(true)
```

These fields are the source of truth for whether the Calendly webhook handler sends booking emails and whether the cron handler sends trial warning emails. All default to `true` (opt-in by default, consistent with user expectation that they receive notifications).

## Build Order

Dependencies drive the order. Each phase can be started only after its dependencies are stable.

```
1. Structured Logging (logger.ts)
   │  Pure refactor. No new env vars. No external services.
   │  Replace console.log across all server-side files.
   │  Lowest risk — makes subsequent phases easier to debug.
   ↓
2. Sentry Error Monitoring
   │  Requires: SENTRY_DSN, SENTRY_AUTH_TOKEN (build-time), NEXT_PUBLIC_SENTRY_DSN
   │  Add @sentry/nextjs, create instrumentation files, wrap next.config.js.
   │  Verify: throw a deliberate test error in dev and check Sentry dashboard.
   ↓
3. PostHog Analytics
   │  Requires: NEXT_PUBLIC_POSTHOG_KEY
   │  Add posthog-js + posthog-node, PHProvider in layout, posthog-server.ts singleton.
   │  Capture: signup, login, booking_processed events.
   ↓
4. Transactional Email Infrastructure
   │  Requires: RESEND_API_KEY, verified sending domain
   │  Add resend SDK, create email.ts singleton, build React Email templates.
   │  Templates: BookingApproved, BookingRejected, TrialExpiry3Days,
   │             TrialExpiry1Day, TrialExpired.
   │  Verify: test sends with Resend's test mode before domain verification.
   ↓
5. Email Preferences Schema + API
   │  Requires: phase 4 (email templates ready before preferences are toggleable)
   │  Prisma migration: add three boolean fields to User.
   │  Add /api/settings/email-preferences route (GET + PATCH).
   │  Add preferences UI section to settings page.
   ↓
6. Booking Notification Emails
   │  Requires: phases 4 + 5 (email.ts + preferences schema)
   │  Modify Calendly webhook handler: send emails after BookingAttempt creation.
   │  Guard sends with preference flags. This modifies the hot path — test thoroughly.
   ↓
7. Trial Expiry Cron + Emails
      Requires: phases 4 + 5 (email.ts + preferences schema)
      Requires: CRON_SECRET env var
      Add /api/cron/trial-expiry route.
      Update vercel.json crons array.
      Implement trial downgrade logic (idempotent).
      Integration test: call route directly with Bearer token in dev.
```

**Phase ordering rationale:**
- Logging first so all subsequent work is observable
- Sentry before PostHog because error monitoring has higher operational priority
- Email infrastructure before wiring it to triggers — template quality can be iterated independently
- Schema migration (phase 5) after templates so preferences toggle something that works
- Booking emails before cron because the webhook is a synchronous hot path and easier to test
- Cron last because it requires a separate deployment artifact (`vercel.json`) and Vercel plan constraints

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture sufficient. Once-per-day Vercel Cron works. Resend free tier covers sends. |
| 1k-10k users | Email volume exceeds Resend free tier (3k/mo). Upgrade to Resend Starter ($20/mo, 50k sends). Add `@@index([trialEndsAt])` to User model for cron query efficiency. |
| 10k+ users | Cron query may need pagination (Prisma `take`/`skip`). Consider queuing email sends via Upstash QStash instead of synchronous Resend calls. |

**First bottleneck:** Cron executes a `prisma.user.findMany` with a date-range filter on `trialEndsAt`. Without an index on `trialEndsAt`, this becomes a full table scan as users grow. Add the index in the same migration as the email preference fields.

**Second bottleneck:** Synchronous email sends inside the cron will eventually hit Resend's rate limits. At scale, the cron should enqueue emails to Upstash QStash and let a separate worker send them.

## Anti-Patterns

### Anti-Pattern 1: Blocking Webhook Response on Email Send

**What people do:** `await sendEmail(...)` inline in the webhook handler, before returning the 200 response.

**Why it's wrong:** If Resend is degraded or slow, the webhook response is delayed. Calendly expects a response within a few seconds. A timeout causes Calendly to retry the webhook, creating duplicate booking processing despite the idempotency key guard (the second attempt will skip, but both spend time waiting on email).

**Do this instead:** Write the BookingAttempt to the database first (as already done). Then fire email in a try/catch. The email failure is logged but does not change the response. The webhook returns 200 regardless of email delivery.

### Anti-Pattern 2: Importing logger.ts in Client Components

**What people do:** Import `src/lib/logger.ts` from a React component file that renders client-side.

**Why it's wrong:** pino references Node.js globals (`process`, `os`, `fs`). Bundling it into the browser payload causes build errors or silent failures.

**Do this instead:** Add `import 'server-only'` at the top of `logger.ts`. Next.js enforces this at build time — any client component that imports `logger.ts` directly or transitively will throw a build error with a clear message. Client-side observability goes through PostHog and Sentry browser SDK, not logger.

### Anti-Pattern 3: Calling posthog-node Without await shutdown()

**What people do:** `getPostHogServer().capture(...)` without calling `await getPostHogServer().shutdown()` before the function returns.

**Why it's wrong:** posthog-node batches events and flushes asynchronously. Vercel serverless functions freeze immediately after returning a response — the async flush never runs and the event is silently dropped.

**Do this instead:** Set `flushAt: 1, flushInterval: 0` (flush immediately on each capture), AND still call `await getPostHogServer().shutdown()` before returning. The `flushAt: 1` setting is the safety net; `shutdown()` is the correct pattern.

### Anti-Pattern 4: Setting SENTRY_AUTH_TOKEN as a Runtime Env Variable

**What people do:** Add `SENTRY_AUTH_TOKEN` to Vercel's environment variables without scoping it to Build only.

**Why it's wrong:** `SENTRY_AUTH_TOKEN` is consumed only by the Sentry webpack plugin during `next build` to upload source maps. If it is set as a runtime variable, it is available to every function invocation, unnecessarily expanding its exposure surface.

**Do this instead:** In the Vercel environment variables UI, set `SENTRY_AUTH_TOKEN` with the scope limited to **Build** only (not Preview Runtime or Production Runtime). The token is never loaded into a running function.

### Anti-Pattern 5: Daily Cron Frequency on Vercel Hobby Plan

**What people do:** Configure a cron expression like `0 */6 * * *` (every 6 hours) on a Hobby plan.

**Why it's wrong:** Vercel rejects the deployment with: *"Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."* The deployment fails.

**Do this instead:** Use `0 9 * * *` (once daily at 09:00 UTC). Trial expiry logic is idempotent and once-per-day is sufficient for the 1-day and 3-day warning email thresholds. If tighter timing is needed later, upgrading to Vercel Pro removes the restriction.

### Anti-Pattern 6: Non-Idempotent Trial Downgrade

**What people do:** `prisma.user.update({ data: { subscriptionTier: 'FREE' } })` without checking current tier.

**Why it's wrong:** Vercel's event-driven cron system can occasionally deliver the same cron event twice. If both invocations run the downgrade without checking state, a user who upgraded to a paid plan after trial expiry could be wrongly downgraded.

**Do this instead:** Use a conditional update: `prisma.user.updateMany({ where: { id: userId, subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now } }, data: { ... } })`. The `WHERE` clause acts as an idempotency guard — the update is a no-op if the user's state has already changed.

## Sources

- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry Next.js Source Maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/)
- [Sentry Vercel Integration](https://docs.sentry.io/organization/integrations/deployment/vercel/)
- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [PostHog + Next.js + Vercel guide](https://vercel.com/kb/guide/posthog-nextjs-vercel-feature-flags-analytics)
- [Resend Next.js Integration](https://resend.com/docs/send-with-nextjs)
- [Vercel Cron Jobs Overview](https://vercel.com/docs/cron-jobs)
- [Vercel Cron Jobs — Managing (security, idempotency, concurrency)](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Cron Jobs — Usage & Pricing (Hobby limits)](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Structured Logging for Next.js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/)

---
*Architecture research for: Protectly v1.0 — production infrastructure additions*
*Researched: 2026-03-21*

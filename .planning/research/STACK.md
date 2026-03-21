# Stack Research

**Domain:** Next.js SaaS — observability, transactional email, trial automation (v1.0 production infrastructure milestone)
**Researched:** 2026-03-21
**Confidence:** HIGH — all versions confirmed against npm registry; integration patterns verified against official docs

---

## Context: What Already Exists

The previous milestone (v0.1 security hardening) is complete. Do NOT re-research these:

| Capability | Package | Version |
|------------|---------|---------|
| Framework | `next` | 15.1.3 |
| Auth | `iron-session` | 8.0.1 |
| ORM | `@prisma/client` | 5.7.1 |
| Rate limiting | `@upstash/ratelimit` + `@upstash/redis` | 2.0.8 / 1.36.2 |
| Env validation | `@t3-oss/env-nextjs` + `zod` | installed |
| HTTP client | Native `fetch` (consolidated from axios in v0.1 Phase 6) | built-in |
| Testing | `vitest` + `@playwright/test` | 4.0.16 / 1.57.0 |

This document covers only **net-new packages** for the v1.0 milestone.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@sentry/nextjs` | 10.45.0 | Error monitoring, source maps, performance tracing | Official Next.js SDK; handles App Router instrumentation, Edge runtime, and Turbopack automatically; one wizard command sets up all three entry points (client/server/edge) |
| `posthog-js` | 1.363.1 | Client-side product analytics and event capture | Industry-standard for product analytics; first-class Next.js App Router support; works in browser client components |
| `posthog-node` | 5.28.5 | Server-side event capture from Route Handlers and Server Actions | Required for server-side PostHog calls (webhook processing, trial expiry events); separate package from posthog-js |
| `resend` | 6.9.4 | Transactional email sending | Modern developer-first API; React Email native support; better free tier (3,000/mo vs Postmark's 100); SOC 2 compliant; idempotency keys on send |
| `react-email` | 5.2.10 | Email template authoring as React components | Write email HTML as TSX; renders to HTML string at send time; avoids Mustache/Handlebars template hell; React 19 compatible |
| `pino` | 10.3.1 | Structured JSON logging replacing console.log/error | Fastest Node.js logger; JSON output in production is machine-parseable for Vercel log drains; minimal API surface |
| `pino-pretty` | 13.1.3 | Dev-mode pretty-printed logs | Only used in development; strips to human-readable output; never runs in production |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/components` | latest (part of react-email) | Pre-built email-safe HTML components (Body, Container, Text, Button, Hr, Link) | All email templates — ensures cross-client rendering compatibility |
| `vitest` (existing) | 4.0.16 | Unit tests for email rendering, cron handler, PostHog events | Already installed; no new test tooling needed |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx @sentry/wizard@latest -i nextjs` | One-command Sentry setup | Generates `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and wraps `next.config.ts` with `withSentryConfig` automatically |
| Vercel Log Drain | Streams pino JSON output to external log aggregator | Optional but recommended; pino JSON format is the prerequisite |

---

## Installation

```bash
# Error monitoring
npm install @sentry/nextjs

# Product analytics (two packages: client + server)
npm install posthog-js posthog-node

# Transactional email
npm install resend react-email @react-email/components

# Structured logging
npm install pino
npm install -D pino-pretty
```

---

## Integration Architecture

### Sentry: Three Entry Points

Next.js requires separate Sentry initialization for three runtimes. The wizard generates these; do not hand-roll:

```
instrumentation.ts          → imports server/edge config based on NEXT_RUNTIME
sentry.client.config.ts     → browser errors, client-side performance
sentry.server.config.ts     → Server Component errors, Route Handler errors
sentry.edge.config.ts       → Middleware errors
```

`next.config.ts` wraps existing config with `withSentryConfig`:
```typescript
import { withSentryConfig } from '@sentry/nextjs'
export default withSentryConfig(nextConfig, { org, project, authToken: process.env.SENTRY_AUTH_TOKEN })
```

Source maps upload requires `SENTRY_AUTH_TOKEN` env var at build time. Set in Vercel dashboard.

**Turbopack note:** `@sentry/nextjs@10.45.0` supports Turbopack source map upload post-build (requires `next@15.4.1+` for full support; current project is on `15.1.3` — webpack upload is fully supported at current version).

### PostHog: Client + Server Split

Client-side (browser, `'use client'` components):
```typescript
// app/providers.tsx — PostHogProvider wraps layout
import posthog from 'posthog-js'
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, { api_host: '/ingest', ... })
```

Server-side (Route Handlers, Server Actions, webhook processing):
```typescript
// lib/posthog.ts — singleton for server calls
import { PostHog } from 'posthog-node'
const client = new PostHog(process.env.POSTHOG_KEY, { flushAt: 1, flushInterval: 0 })
// flushAt: 1, flushInterval: 0 required in serverless — prevents events buffering unsent
await client.shutdown() // call at end of handler
```

Use a Next.js Rewrite in `next.config.ts` to proxy PostHog via `/ingest` — avoids ad blockers and keeps first-party cookie context.

### Resend + React Email

```typescript
// lib/email.ts
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({ to, subject, template }: EmailParams) {
  const { data, error } = await resend.emails.send({
    from: 'Protectly <notifications@yourdomain.com>',
    to,
    subject,
    react: template,  // React Email component rendered by Resend SDK
  })
  if (error) throw new Error(`Email send failed: ${error.message}`)
  return data
}
```

Email templates live in `src/emails/` as `.tsx` files that default-export a React component.

### Pino: next.config.ts External Packages

Pino uses worker threads internally. In Next.js 15, it must be listed as a server external package to prevent bundling:

```typescript
// next.config.ts
const nextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty'],  // Next.js 15 stable key (renamed from serverComponentsExternalPackages)
}
```

Logger factory:
```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino(
  process.env.NODE_ENV === 'production'
    ? { level: 'info' }
    : { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } }
)
```

**Edge runtime caveat:** Pino does NOT work in Next.js Middleware (edge runtime). Any file that runs in middleware must use `console.log` directly. The webhook and API route handlers run in Node.js runtime — pino works there.

### Vercel Cron: No Additional Package

Vercel Cron requires only `vercel.json` configuration and a Route Handler. No npm package needed.

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/expire-trials",
      "schedule": "0 2 * * *"
    }
  ]
}
```

```typescript
// app/api/cron/expire-trials/route.ts
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... trial expiry logic
}
```

**Vercel Hobby plan limitation:** Cron jobs run at most once per day on Hobby plans. Trial expiry checks running nightly at 02:00 UTC is within limits. Upgrade to Pro for sub-daily frequency.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `resend` | `@postmark/postmark` | Postmark if inbound email parsing is needed (support ticket reply threading) — Protectly has no inbound email use case |
| `resend` + `react-email` | `nodemailer` + Handlebars | Nodemailer if self-hosting SMTP or using existing SMTP relay — adds operational overhead with no benefit on Vercel |
| `pino` | `winston` | Winston has richer transport options for non-Vercel deployments; for Vercel stdout-only logging, pino is faster and simpler |
| `posthog-node` | Mixpanel, Amplitude | PostHog is open-source, self-hostable, and the most developer-friendly option for early SaaS; no lock-in |
| `@sentry/nextjs` | Datadog, New Relic | Sentry has the best Next.js App Router integration and generous free tier (5K errors/mo); Datadog better for large infrastructure teams |
| `@react-email/components` | MJML | MJML compiles to HTML but requires a separate compilation step; React Email renders in the same Node.js process without an extra build step |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@posthog/next` | Currently version 0.1.0 — alpha quality, unstable API, minimal adoption | `posthog-js` (client) + `posthog-node` (server) — the battle-tested pair documented by PostHog |
| `winston` | ~4x slower than pino; complex transport config for simple Vercel stdout logging | `pino` with `serverExternalPackages` |
| `nodemailer` | Designed for SMTP connections; adds config complexity for a REST API service | `resend` SDK |
| Email templates as string literals | Impossible to maintain; no type safety; no component reuse | `react-email` TSX components |
| `node-cron` or `cron` npm packages | Cron runs on the server process — impossible in Vercel serverless (no persistent process) | Vercel Cron + Route Handler |
| `@sentry/node` (bare) | Missing Next.js App Router instrumentation hooks; no source map upload integration | `@sentry/nextjs` which wraps `@sentry/node` with Next.js specifics |

---

## Stack Patterns by Variant

**If on Vercel Hobby plan:**
- Cron frequency limited to once per day — trial expiry check at nightly UTC is sufficient
- Upgrade to Pro if sub-daily cron is needed (e.g., hourly retry logic)

**If email volume exceeds Resend free tier (3,000/mo):**
- Upgrade to Resend Pro ($20/mo for 50K emails) — no code changes required
- Alternatively, switch to Postmark (comparable API, better deliverability reputation, but only 100 free/mo)

**For local development:**
- Set `RESEND_API_KEY` to a test key — Resend provides sandbox mode
- Set `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_KEY` to test project keys
- Pino outputs pretty-printed logs automatically when `NODE_ENV !== 'production'`
- Sentry errors visible in Sentry dashboard even from localhost with `debug: true` in config

---

## New Environment Variables Required

```bash
# Sentry
SENTRY_AUTH_TOKEN=          # Build-time only; upload source maps; set in Vercel dashboard
NEXT_PUBLIC_SENTRY_DSN=     # Client-side Sentry DSN; safe to expose

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=    # Public key for browser SDK (posthog-js)
POSTHOG_KEY=                # Server key for posthog-node (same key, different var for clarity)
NEXT_PUBLIC_POSTHOG_HOST=   # Usually https://app.posthog.com or EU: https://eu.posthog.com

# Email
RESEND_API_KEY=             # Resend API key from resend.com dashboard
EMAIL_FROM=                 # Verified sending address, e.g. notifications@yourdomain.com

# Cron security
CRON_SECRET=                # Random secret; Vercel sends as Authorization: Bearer header
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@sentry/nextjs@10.45.0` | Next.js 15.x, React 19 | Full App Router support; Turbopack source maps require next@15.4.1+ (current is 15.1.3 — webpack upload works) |
| `posthog-js@1.363.1` | React 19, Next.js 15 | Works in Client Components with `'use client'`; PostHogProvider wraps layout |
| `posthog-node@5.28.5` | Node.js 18+ | Server-only; use `flushAt: 1, flushInterval: 0` in serverless |
| `resend@6.9.4` | Node.js 18+, Edge Runtime | HTTP-based client; Edge Runtime compatible |
| `react-email@5.2.10` | React 19 | React Email 5 explicitly supports React 19 |
| `pino@10.3.1` | Node.js 18+ | Not Edge Runtime compatible; add to `serverExternalPackages` in next.config.ts |
| Vercel Cron | All Vercel plans | Hobby: max once/day; Pro: up to once/minute |

---

## Sources

- [@sentry/nextjs npm](https://www.npmjs.com/package/@sentry/nextjs) — version 10.45.0 confirmed
- [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/) — instrumentation setup, withSentryConfig pattern — HIGH confidence
- [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js) — client/server package split, flushAt/flushInterval requirement — HIGH confidence
- [posthog-js npm](https://www.npmjs.com/package/posthog-js) — version 1.363.1 confirmed
- [posthog-node npm](https://www.npmjs.com/package/posthog-node) — version 5.28.5 confirmed
- [@posthog/next npm](https://www.npmjs.com/package/@posthog/next) — version 0.1.0 (alpha) confirmed — basis for "do not use" recommendation
- [resend npm](https://www.npmjs.com/package/resend) — version 6.9.4 confirmed
- [react-email npm](https://www.npmjs.com/package/react-email) — version 5.2.10 confirmed
- [Resend pricing](https://resend.com/pricing) — 3,000 emails/mo free tier confirmed — HIGH confidence
- WebSearch: Resend vs Postmark comparison 2026 — Resend recommended for Next.js/React ecosystem — MEDIUM confidence
- [pino npm](https://www.npmjs.com/package/pino) — version 10.3.1 confirmed
- [pino-pretty npm](https://www.npmjs.com/package/pino-pretty) — version 13.1.3 confirmed
- [Arcjet structured logging guide](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — `serverExternalPackages` config for pino — MEDIUM confidence
- WebSearch: pino Next.js 15 `serverExternalPackages` (renamed from `serverComponentsExternalPackages`) — MEDIUM confidence
- [Vercel Cron docs](https://vercel.com/docs/cron-jobs) — vercel.json schema, CRON_SECRET pattern — HIGH confidence
- [Vercel Cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby plan daily limit confirmed — HIGH confidence

---

*Stack research for: Protectly v1.0 production infrastructure (observability, email, trial automation)*
*Researched: 2026-03-21*

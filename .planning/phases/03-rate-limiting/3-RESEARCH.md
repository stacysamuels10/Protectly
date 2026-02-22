# Phase 3: Rate Limiting - Research

**Researched:** 2026-02-22
**Domain:** Next.js 15 middleware rate limiting via Upstash Redis — sliding window, per-route limits, webhook exclusion, graceful degradation
**Confidence:** HIGH — all library versions confirmed from npm registry; Next.js 15.5.9 behavior confirmed from official blog; Upstash free tier from official docs

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACL-01 | All API endpoints have rate limiting enforced (webhook: 100/min by IP, allowlist writes: 30/min by user, auth: 10/min by IP) | Sliding window via @upstash/ratelimit 2.0.8 in Node.js middleware; per-route identifiers (IP for auth, userId from session for allowlist writes); webhook paths excluded via matcher |
</phase_requirements>

---

## Summary

Phase 3 adds a single `middleware.ts` file that intercepts all non-webhook API requests and enforces sliding window rate limits backed by Upstash Redis. The middleware uses the **Node.js runtime** (stable in Next.js 15.5.9, our installed version) rather than the default Edge runtime — this is necessary because reading the `iron-session` cookie for per-user limits requires Node.js `crypto`, which is not available in the Edge runtime.

The critical per-route requirements are: auth endpoints at 10/min per IP, allowlist write mutations at 30/min per authenticated user, and webhook paths (`/api/webhooks/*`) **completely excluded** from the matcher so Calendly and Stripe are never rate-limited. The middleware creates separate `Ratelimit` instances with different `slidingWindow` configurations and different key prefixes, then selects the right limiter based on `request.nextUrl.pathname`.

Local development degrades gracefully: when `UPSTASH_REDIS_REST_URL` is absent, the rate limiter is `null` and all checks return `{ success: true }`. Two new env vars are required in production: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Primary recommendation:** Use `@upstash/ratelimit@2.0.8` + `@upstash/redis@1.36.2` in a Node.js runtime `middleware.ts` with a path-based limiter selector and an explicit matcher that excludes `/api/webhooks/*`. Use `iron-session` to read `userId` from the cookie for the allowlist write limiter.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/ratelimit` | 2.0.8 (latest) | Sliding window rate limit counters in Redis | Only connectionless (HTTP-based) Redis rate limiter; works in serverless/edge; official Vercel template |
| `@upstash/redis` | 1.36.2 (latest) | Redis client for Upstash | HTTP-native client; peer dep required by @upstash/ratelimit; no persistent TCP connection |

**Confirmed from npm registry:** `@upstash/ratelimit` latest is `2.0.8`; `@upstash/redis` latest is `1.36.2`. The ratelimit package's peer dependency requires `@upstash/redis >= 1.34.3` — `1.36.2` satisfies this.

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `iron-session` | 8.0.1 (installed) | Read userId from encrypted cookie in Node.js middleware | Per-user rate limiting on allowlist write routes |
| `next` | 15.5.9 (installed) | Provides `middleware.ts` hook; Node.js runtime now stable | Middleware file with `export const config = { runtime: 'nodejs' }` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@upstash/ratelimit` | `rate-limiter-flexible` | Requires own Redis client setup; more boilerplate; not packaged for Next.js middleware use |
| `@upstash/ratelimit` | In-memory `Map` | Resets on every cold start; silently fails in multi-instance Vercel deployments |
| `@upstash/ratelimit` | PostgreSQL counter table | Works but adds DB write latency to every API request; Prisma not available in middleware |
| Node.js middleware runtime | Edge middleware runtime | Edge runtime cannot use `iron-session` (requires Node.js `crypto`); can only do IP-based limiting |

**Installation:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

No other new packages needed. `iron-session` is already installed at `8.0.1`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/                           (no src/ middleware — middleware.ts goes at project root)
middleware.ts                  # NEW — rate limiting middleware
src/lib/
├── rate-limit.ts              # NEW — Ratelimit instance factory + null-safe check helper
└── session.ts                 # EXISTING — reuse getIronSession for userId in middleware
```

`middleware.ts` must be at the **project root** (same level as `package.json`, `next.config.js`). This project has no existing `middleware.ts`.

### Pattern 1: Multiple Limiters with Path-Based Selection

**What:** Create separate `Ratelimit` instances for each rate limit tier, keyed with different `prefix` values. The middleware selects the correct limiter and identifier based on the current request path.

**When to use:** When different routes need different limits or different identifier strategies (IP vs. userId).

**Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getIronSession } from 'iron-session'

// Source: npm @upstash/ratelimit@2.0.8 + Next.js 15.5.9 stable Node.js middleware

export const config = {
  runtime: 'nodejs',  // REQUIRED — iron-session uses Node.js crypto
  matcher: [
    '/api/auth/:path*',
    '/api/allowlists/:path*',
    '/api/billing/:path*',
    '/api/settings/:path*',
    '/api/dashboard/:path*',
    // /api/webhooks/:path* is intentionally EXCLUDED
  ],
}

// Null when UPSTASH_REDIS_REST_URL is not set — graceful dev degradation
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

const limiters = redis
  ? {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'rl:auth',
      }),
      allowlistWrites: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'rl:allowlist-writes',
      }),
      general: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        prefix: 'rl:general',
      }),
    }
  : null

export async function middleware(request: NextRequest) {
  // Graceful degradation: no Upstash configured → allow all
  if (!limiters) return NextResponse.next()

  const path = request.nextUrl.pathname

  // IP extraction — request.ip was REMOVED in Next.js 15
  // Use x-forwarded-for instead
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'

  let identifier: string
  let limiter: Ratelimit

  if (path.startsWith('/api/auth')) {
    identifier = `ip:${ip}`
    limiter = limiters.auth

  } else if (path.startsWith('/api/allowlists')) {
    const method = request.method
    const isWrite = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'

    if (isWrite) {
      // Read userId from iron-session cookie — works because we're in Node.js runtime
      const session = await getIronSession<{ userId?: string; isLoggedIn?: boolean }>(
        request,
        new Response(),  // dummy response — we only need to read
        { password: process.env.SESSION_SECRET!, cookieName: 'prical_session' }
      )
      identifier = session.userId ? `user:${session.userId}` : `ip:${ip}`
      limiter = limiters.allowlistWrites
    } else {
      identifier = `ip:${ip}`
      limiter = limiters.general
    }

  } else {
    identifier = `ip:${ip}`
    limiter = limiters.general
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return NextResponse.next()
}
```

### Pattern 2: Null-Safe Rate Limit Helper (for route-level use)

**What:** A helper in `src/lib/rate-limit.ts` that wraps limiter creation for use inside route handlers (alternative to middleware approach, or as supplement).

**When to use:** If per-route logic becomes too complex for a single middleware, or for testing rate limit logic in isolation.

**Example:**
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? Redis.fromEnv()
  : null

export function createRatelimit(tokens: number, window: string, prefix: string): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix })
}

export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  if (!limiter) return { allowed: true, headers: {} }
  const { success, limit, remaining, reset } = await limiter.limit(identifier)
  return {
    allowed: success,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(reset),
    },
  }
}
```

### Pattern 3: Middleware Matcher Webhook Exclusion

**What:** The `config.matcher` in `middleware.ts` controls which paths the middleware runs on. Webhook paths must be **absent** from the matcher — they are not rate-limited at the middleware layer. Signature verification is their gate.

**Critical:** Do NOT add `/api/webhooks/:path*` to the matcher. Calendly and Stripe use CDN IPs; rate limiting by IP causes false positives and retry cascades.

```typescript
// Correct matcher — webhooks excluded by omission
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/api/auth/:path*',
    '/api/allowlists/:path*',
    '/api/billing/:path*',
    '/api/settings/:path*',
    '/api/dashboard/:path*',
  ],
}

// WRONG — do not do this:
// matcher: ['/api/:path*']  // This would catch webhooks
```

### Anti-Patterns to Avoid

- **In-memory rate limiting (`Map<string, number[]>`):** Resets on every serverless cold start. Never effective in production on Vercel. Already documented as a known pitfall.
- **`request.ip` for IP extraction:** Was **removed** in Next.js 15 (our version is 15.5.9). Use `request.headers.get('x-forwarded-for')` only.
- **Edge runtime for this middleware:** Cannot use `iron-session` in Edge runtime because iron-session uses Node.js `crypto`. The Node.js runtime is stable in Next.js 15.5.9 — use it.
- **Applying the general matcher `/api/:path*`:** Catches `/api/webhooks/*` and will rate-limit Calendly/Stripe by IP, causing false 429s and retry storms.
- **Hardcoding `process.env.UPSTASH_REDIS_REST_TOKEN` without null check:** If the env var is missing and `redis` is non-null, `Redis.fromEnv()` will throw. Always gate on the URL being set first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sliding window rate limit counter | Custom `Map` with timestamp arrays | `@upstash/ratelimit` | Correct sliding window math is subtle; Upstash handles multi-instance coordination via Redis |
| Redis client for serverless | `ioredis` with TCP connection | `@upstash/redis` | TCP connections time out in serverless; Upstash Redis uses HTTP fetch — no persistent connection |
| Per-user limit key derivation | Manual cookie parsing in middleware | `iron-session` + Node.js runtime | Cookie decryption requires Node.js crypto; iron-session already handles the format |
| 429 response headers | Ad-hoc header construction | Use `limit`, `remaining`, `reset` from `ratelimit.limit()` return value | Return value includes all needed values; `reset` is epoch ms |

**Key insight:** Rate limiting in a serverless environment is a distributed systems problem. Local state is invalid; all counters must live in Redis. The `@upstash/ratelimit` library handles the sliding window math, atomic Redis operations, and expiry — building this correctly from scratch requires at minimum `EVAL` scripts or transactions.

---

## Common Pitfalls

### Pitfall 1: Using `request.ip` (Removed in Next.js 15)

**What goes wrong:** Middleware uses `request.ip ?? '127.0.0.1'` — this was valid in Next.js 13/14 examples. In Next.js 15 (our version: 15.5.9), `request.ip` was removed. The value is always `undefined`, so every request gets identifier `127.0.0.1` and all users share the same rate limit bucket — effectively a global rate limiter that breaks at ~10 total auth requests per minute app-wide.

**Why it happens:** The official `@upstash/ratelimit` example middleware and many blog posts (including the Upstash blog) still use `request.ip`. These examples predate the Next.js 15 change.

**How to avoid:** Use `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'`. On Vercel, the first IP in `x-forwarded-for` is the real client IP. Locally, this header is absent and `127.0.0.1` is the correct fallback.

**Warning signs:** All requests hitting 429 simultaneously; rate limit logs show same identifier for all requests.

---

### Pitfall 2: Running Middleware in Edge Runtime When Iron-Session Is Needed

**What goes wrong:** Default Next.js middleware runs in the Edge runtime. `iron-session` uses Node.js `crypto` (`createHmac`, `createCipheriv`) internally for cookie encryption/decryption. Edge runtime blocks `crypto` module access — calling `getIronSession()` in Edge middleware throws a runtime error or silently returns an empty session.

**Why it happens:** Edge runtime is the Next.js middleware default. Developers don't notice until they try to read session data.

**How to avoid:** Add `runtime: 'nodejs'` to the middleware `config` export. This is **stable** in Next.js 15.5.9 (stabilized in 15.5, after being experimental since 15.2). No experimental flag needed.

```typescript
export const config = {
  runtime: 'nodejs',  // stable in 15.5.9 — no experimental flag needed
  matcher: [...],
}
```

**Warning signs:** `crypto is not defined` or `The edge runtime does not support Node.js` errors in middleware.

---

### Pitfall 3: Including Webhook Paths in the Middleware Matcher

**What goes wrong:** A wildcard matcher like `/api/:path*` catches `/api/webhooks/calendly` and `/api/webhooks/stripe`. Calendly and Stripe send webhooks from multiple CDN IPs. A single Calendly event might arrive from different IPs on retry. The IP-based rate limiter returns 429 after 10 requests/minute from any given IP, causing Calendly to enter an exponential backoff retry cycle that generates more 429s — a webhook failure cascade.

**Why it happens:** Using `/api/:path*` as the matcher is simpler than explicitly listing each route. Developers overlook that webhooks are in `/api/`.

**How to avoid:** List only the routes that should be rate-limited. Webhook paths should never appear in the matcher. The route-specific matcher approach is also more explicit and easier to audit:

```typescript
matcher: [
  '/api/auth/:path*',
  '/api/allowlists/:path*',
  '/api/billing/:path*',
  '/api/settings/:path*',
  '/api/dashboard/:path*',
  // /api/webhooks/:path* — intentionally absent
]
```

**Warning signs:** Calendly webhook delivery failures in Upstash dashboard; incoming webhook retries in Calendly subscription logs.

---

### Pitfall 4: Upstash Free Tier Command Budget for Sliding Window

**What goes wrong:** The sliding window algorithm makes **2 Redis commands per rate limit check** (one to get current window count, one to get previous window count). With multiple limiters (auth, allowlist-writes, general) and many routes, the 500K commands/month free tier is consumed faster than expected.

**Calculation for this project:**
- 500K commands/month = ~16,667 commands/day
- 2 commands per check, 3 limiter tiers
- Effective budget: ~8,333 distinct rate limit checks/day before commands are the bottleneck
- At 10 auth requests/min/IP, this is ~833 auth request windows/day before exhaustion from auth alone

**At early SaaS scale (< 100 active users/day), 500K/month is more than sufficient.** At higher scale, upgrade to the $10/month plan (unlimited commands).

**How to avoid:** Set `analytics: false` (default) unless actively using the Upstash analytics dashboard — analytics doubles command usage. Monitor the Upstash console for command counts.

**Warning signs:** Upstash console shows commands approaching 500K; rate limit checks returning `success: true` even for abusive patterns (fail-open timeout triggered because Redis is rate-limiting the rate limiter's own calls).

---

### Pitfall 5: Iron-Session getIronSession API in Middleware

**What goes wrong:** In route handlers, `getIronSession` accepts `cookies()` from `next/headers` as the first argument. In middleware, `cookies()` is not available — you only have the `NextRequest` object. Passing `NextRequest` directly requires a different call signature; the session options (password, cookieName) must come from `process.env` directly rather than from `env.ts` (which requires full module initialization).

**How to avoid:**
```typescript
// In middleware — use request directly, not cookies()
const session = await getIronSession<{ userId?: string }>(
  request,
  new Response(),  // dummy — we only read, don't need to set cookies
  {
    password: process.env.SESSION_SECRET!,
    cookieName: 'prical_session',
  }
)
```

Note: `env.ts` imports `@t3-oss/env-nextjs` which may trigger validation. In middleware, access `process.env.SESSION_SECRET` directly to avoid the full env validation chain.

**Warning signs:** `Cannot read properties of undefined` when calling `getIronSession` in middleware; session always empty even for authenticated users.

---

## Code Examples

Verified patterns from official sources and confirmed against Next.js 15.5.9 + @upstash/ratelimit 2.0.8:

### Complete middleware.ts

```typescript
// middleware.ts — project root
// Source: @upstash/ratelimit 2.0.8 + Next.js 15.5.9 stable Node.js middleware
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getIronSession } from 'iron-session'

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/api/auth/:path*',
    '/api/allowlists/:path*',
    '/api/billing/:path*',
    '/api/settings/:path*',
    '/api/dashboard/:path*',
  ],
}

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : null

const limiters = redis
  ? {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'rl:auth',
        analytics: false,
      }),
      allowlistWrites: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'rl:allowlist-writes',
        analytics: false,
      }),
      general: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        prefix: 'rl:general',
        analytics: false,
      }),
    }
  : null

function getIP(request: NextRequest): string {
  // request.ip was removed in Next.js 15 — use x-forwarded-for
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!limiters) return NextResponse.next()

  const path = request.nextUrl.pathname
  const ip = getIP(request)
  const method = request.method

  let identifier: string
  let limiter: Ratelimit

  if (path.startsWith('/api/auth')) {
    identifier = `ip:${ip}`
    limiter = limiters.auth

  } else if (
    path.startsWith('/api/allowlists') &&
    (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')
  ) {
    // Per-user limit for allowlist writes — read session cookie
    const session = await getIronSession<{ userId?: string }>(
      request,
      new Response(),
      {
        password: process.env.SESSION_SECRET!,
        cookieName: 'prical_session',
      }
    )
    identifier = session.userId ? `user:${session.userId}` : `ip:${ip}`
    limiter = limiters.allowlistWrites

  } else {
    identifier = `ip:${ip}`
    limiter = limiters.general
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return NextResponse.next()
}
```

### Env vars to add

```bash
# .env.local (dev — if you want to test with real Redis locally)
# Leave these UNSET for graceful degradation (all checks pass)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# Production (Vercel + Railway): set in dashboard
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

These env vars are **optional** — when absent, all rate limit checks return `{ success: true }`. The `env.ts` Zod schema should NOT make them required (would break local dev and test environments where Upstash is not configured).

### Vitest test pattern for rate limit middleware

```typescript
// middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the ratelimit module before importing middleware
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: false,   // simulate rate limited
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    }),
  })),
}))

// ... test that 11th request returns 429
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `request.ip` in Next.js middleware | `request.headers.get('x-forwarded-for')` | Next.js 15.0 | All Upstash blog examples using `request.ip` are outdated |
| `experimental.nodeMiddleware: true` flag | `export const config = { runtime: 'nodejs' }` (stable) | Next.js 15.5 | No experimental flag needed; Node.js middleware is production-ready |
| Separate `@upstash/redis` version `~1.x` | `@upstash/redis@1.36.2` | Current (Feb 2026) | Package confirmed on npm; ratelimit requires >= 1.34.3 |
| `@upstash/ratelimit` `~1.x` | `@upstash/ratelimit@2.0.8` | Current (Feb 2026) | 2.x is stable latest; `2.0.5-canary` branch exists but `2.0.8` is `latest` tag |

**Deprecated/outdated:**
- `request.ip`: Removed in Next.js 15; do not use.
- `experimental.nodeMiddleware: true` in `next.config.js`: Was needed in 15.2; removed in 15.5 (stable).
- `@upstash/ratelimit` `Ratelimit.ephemeralCache` as constructor option: Still available in 2.x but `new Map()` is auto-initialized by default; passing it explicitly is redundant.

---

## Open Questions

1. **Iron-session getIronSession middleware call signature**
   - What we know: `getIronSession(request, response, options)` is the middleware-compatible overload; `cookies()` from `next/headers` is Route Handler-only
   - What's unclear: Whether `new Response()` as the dummy response argument works correctly in iron-session 8.0.1 for read-only session access, or if a `NextResponse` object is needed
   - Recommendation: Test this in a quick spike before writing the full middleware. If `new Response()` doesn't work, fall back to IP-only limiting for the allowlist write route (less precise, still safe).

2. **Upstash free tier behavior when 500K commands/month is exhausted**
   - What we know: The free tier is 500K commands/month with a hard cap; there is no automatic fail-open documented
   - What's unclear: Whether the Redis API returns an error (causing the fail-open timeout to trigger) or blocks requests
   - Recommendation: Upstash's timeout feature means the limiter will fail-open if Redis is unavailable; document this as expected behavior.

3. **Railway Redis as fallback for Railway-only deploys**
   - What we know: Railway has a managed Redis add-on; `ioredis` can connect to it; `@upstash/redis` uses HTTP so cannot connect to standard Railway Redis (TCP only)
   - What's unclear: Whether this project deploys to Railway or Vercel for production
   - Recommendation: If deploying to Vercel, use Upstash (HTTP-based, works on Edge/serverless). If deploying to Railway Node.js server, could use `rate-limiter-flexible` with `ioredis`. The graceful degradation pattern means this decision does not block the phase — implement Upstash, add Railway Redis as a future option if needed.

---

## Sources

### Primary (HIGH confidence)

- npm registry: `@upstash/ratelimit` 2.0.8 (latest), `@upstash/redis` 1.36.2 (latest) — confirmed via `npm show` command run 2026-02-22
- Next.js 15.5 release blog: `https://nextjs.org/blog/next-15-5` — confirmed Node.js middleware runtime is **stable** in 15.5, no experimental flag needed
- Next.js 15 upgrade guide (web search): `request.ip` removed in Next.js 15; use `x-forwarded-for` instead
- Upstash free tier: `https://upstash.com/docs/redis/overall/pricing` — 500K commands/month, 256MB, 10GB bandwidth
- Upstash ratelimit features: `https://upstash.com/docs/redis/sdks/ratelimit-ts/features` — confirmed fail-open timeout, multiple limits API, `slidingWindow` algorithm support
- Project codebase: `package.json` (next@15.5.9 installed), `src/env.ts` (env vars and schema), `src/lib/session.ts` (cookie name: `prical_session`)

### Secondary (MEDIUM confidence)

- Upstash GitHub example: `https://github.com/upstash/ratelimit-js/tree/main/examples/nextjs-middleware` — shows middleware structure (uses old `request.ip`; IP extraction updated to match Next.js 15)
- Upstash blog edge rate limiting: `https://upstash.com/blog/edge-rate-limiting` — sliding window middleware pattern confirmed; IP extraction updated

### Tertiary (LOW confidence)

- Iron-session middleware call signature with `new Response()` as dummy arg — from web search only; needs direct testing

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages/versions): HIGH — confirmed directly from npm registry
- Architecture (middleware pattern): HIGH — confirmed from Next.js 15.5 blog + Upstash official docs
- IP extraction change: HIGH — confirmed from Next.js upgrade docs and web search with multiple sources
- Node.js runtime stable: HIGH — confirmed from Next.js 15.5 official blog post (Aug 2025)
- Iron-session in middleware read signature: MEDIUM — approach matches library design but dummy Response arg needs testing
- Upstash free tier adequacy: HIGH — 500K/month commands is well above early SaaS needs
- Railway Redis fallback: LOW — not yet decided; graceful degradation means it's not blocking

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (stable libraries; Next.js 16 may change middleware runtime defaults but 15.5.9 is locked)

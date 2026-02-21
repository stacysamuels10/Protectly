# Architecture Research

**Domain:** Next.js 15 SaaS security hardening — field-level encryption, rate limiting, audit logging, env validation
**Researched:** 2026-02-20
**Confidence:** HIGH (based on codebase inspection + Next.js 15 official docs)

---

## Standard Architecture

### System Overview: Security Hardening Layers on Existing Stack

The existing architecture has five structural layers. Security hardening adds three cross-cutting layers that hook into specific seams without requiring a full rewrite.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BROWSER / EXTERNAL SERVICES                       │
│   (User Browser)         (Calendly Webhook)      (Stripe Webhook)   │
└────────────────┬─────────────────┬───────────────────┬─────────────┘
                 │                 │                   │
┌────────────────▼─────────────────▼───────────────────▼─────────────┐
│              [NEW] ENV VALIDATION LAYER — src/lib/env.ts            │
│   Runs at module load time. Throws if required vars are missing.    │
│   No request reaches the app if startup validation fails.           │
└─────────────────────────────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────────────┐
│           [NEW] RATE LIMITING LAYER — middleware.ts                   │
│   Runs before every route handler. Checks request rate by IP or     │
│   session cookie. Returns 429 without hitting route handlers.       │
│   Configured per-path via matcher config.                           │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │                                  │
┌──────────▼───────────────┐   ┌──────────────▼──────────────────────┐
│    API LAYER             │   │   WEBHOOK HANDLERS                   │
│    src/app/api/          │   │   /api/webhooks/calendly             │
│    (auth, allowlists,    │   │   /api/webhooks/stripe               │
│     billing, settings,   │   │                                      │
│     dashboard)           │   │   Rate limit exempt (signature       │
│                          │   │   verification is the gate)          │
└──────────┬───────────────┘   └──────────────┬──────────────────────┘
           │                                  │
┌──────────▼──────────────────────────────────▼──────────────────────┐
│           AUTHENTICATION / SESSION LAYER                             │
│           src/lib/session.ts  — getCurrentUser()                    │
│           iron-session cookie, 1-week expiry                        │
└─────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│           SERVICE INTEGRATION LAYER                                  │
│           src/lib/calendly.ts   src/lib/stripe.ts                   │
│           [MODIFIED] Tokens encrypted before write, decrypted       │
│           before use — transparent to callers                       │
└─────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────────────┐
│           DATA LAYER — Prisma + PostgreSQL                           │
│           src/lib/prisma.ts                                         │
│           [NEW] Prisma $use middleware intercepts allowlist         │
│           mutations → writes AuditLog records                       │
│                                                                     │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│   │   User       │ │  Allowlist   │ │BookingAttempt│ │AuditLog  │ │
│   │  (tokens:    │ │   Entry      │ │              │ │ [NEW]    │ │
│   │  encrypted)  │ │              │ │              │ │          │ │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### New Security Components

| Component | File | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| Env Validation | `src/lib/env.ts` | Parse and validate all environment variables at startup using Zod; export typed `env` object | Imported by all `src/lib/*.ts` modules instead of `process.env` directly |
| Rate Limiter | `middleware.ts` (project root or `src/`) | Intercept all `/api/*` requests; check rate by IP+path; return 429 before route handler fires | `@upstash/ratelimit` + Upstash Redis (or in-memory alternative for Railway) |
| Encryption Module | `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt; no Prisma dependency; pure crypto | Called by OAuth callback (write) and `calendlyRequest()` helper (read) |
| Audit Logger | `src/lib/prisma.ts` (via `$use`) | Intercept Prisma mutations on `Allowlist`, `AllowlistEntry`; write `AuditLog` records | Prisma client singleton; reads actor from async context |
| AuditLog Model | `prisma/schema.prisma` | Persist immutable audit records: who, what, when, on which record | Read by dashboard activity queries |

### Existing Components (Modified)

| Component | File | What Changes |
|-----------|------|-------------|
| Calendly OAuth Callback | `src/app/api/auth/calendly/callback/route.ts` | Call `encrypt(tokens.access_token)` and `encrypt(tokens.refresh_token)` before Prisma write |
| calendlyRequest helper | `src/lib/calendly.ts` | Call `decrypt(user.calendlyAccessToken)` before passing token to API call |
| cancelBookingWithRetry | `src/app/api/webhooks/calendly/route.ts` | Call `decrypt()` before using access/refresh tokens |
| Webhook timestamp check | `src/lib/webhook.ts` | Tighten `toleranceMs` from 180000 (3 min) to 60000 (60 sec) |
| Email comparison | `src/app/api/webhooks/calendly/route.ts` | Replace `.toLowerCase()` string equality with `crypto.timingSafeEqual()` |
| Prisma singleton | `src/lib/prisma.ts` | Register `$use` middleware for audit logging |
| Session config | `src/lib/session.ts` | Remove fallback — require `env.SESSION_SECRET` (never undefined) |

---

## Data Flow

### 1. Startup: Env Validation

```
Process starts
    ↓
src/lib/env.ts loads (imported by first module that needs it)
    ↓
Zod schema parses process.env
    ↓
MISSING VARS? → throw at startup (app crashes with clear message)
ALL VALID?    → export typed `env` object
    ↓
All subsequent modules use env.DATABASE_URL, env.SESSION_SECRET, etc.
```

**Hook point:** Module import time. Since `env.ts` is imported by `prisma.ts`, `session.ts`, and `calendly.ts`, it runs before any request is handled.

### 2. Inbound Request: Rate Limiting

```
HTTP request arrives (any /api/* route)
    ↓
middleware.ts (Next.js Middleware — runs at Edge/Node before route handler)
    ↓
Extract identifier: IP from headers (x-forwarded-for) + route path
    ↓
Check rate store (Redis or in-memory LRU)
    ↓
LIMIT EXCEEDED? → NextResponse.json({ error: 'Too many requests' }, { status: 429 })
UNDER LIMIT?    → NextResponse.next() → request continues to route handler
```

**Hook point:** `middleware.ts` at project root. Matcher targets `/api/:path*` but **excludes** `/api/webhooks/:path*` (webhook endpoints should not be rate-limited by IP — Calendly and Stripe send from many IPs; signature verification is their gate).

**Identifier strategy by route:**
- `/api/auth/*` — rate limit by IP (prevent credential stuffing)
- `/api/allowlists/*` — rate limit by session userId (from cookie, via header set in middleware)
- `/api/settings/*` — rate limit by session userId
- `/api/billing/*` — rate limit by IP (no auth required for checkout initiation)

### 3. OAuth Callback: Token Encryption Write Path

```
User completes Calendly OAuth
    ↓
/api/auth/calendly/callback/route.ts
    ↓
exchangeCodeForTokens() → { access_token, refresh_token }
    ↓
encrypt(access_token)  → { ciphertext, iv, authTag }  (AES-256-GCM)
encrypt(refresh_token) → { ciphertext, iv, authTag }
    ↓
Store as base64-encoded JSON string in User.calendlyAccessToken (String @db.Text)
    ↓
Prisma writes encrypted blob to PostgreSQL
```

**Hook point:** The two `prisma.user.create()` / `prisma.user.update()` calls in the OAuth callback. No schema change required — the `@db.Text` column is wide enough to hold the encrypted envelope.

### 4. Webhook Processing: Token Decryption Read Path

```
Calendly invitee.created webhook received
    ↓
/api/webhooks/calendly/route.ts → cancelBookingWithRetry(user, ...)
    ↓
user.calendlyAccessToken is encrypted blob from DB
    ↓
decrypt(user.calendlyAccessToken) → plaintext access token
    ↓
cancelCalendlyEvent(plaintextToken, eventUri, message)
    ↓
If 401: decrypt(user.calendlyRefreshToken) → plaintext refresh token
         refreshAccessToken(plaintextRefreshToken)
         encrypt(newTokens.access_token) → store encrypted
         retry cancelCalendlyEvent(newPlaintextToken, ...)
```

**Hook point:** The `cancelBookingWithRetry` function. The `calendlyRequest<T>()` generic helper in `src/lib/calendly.ts` also reads tokens and must decrypt before use.

### 5. Allowlist Mutations: Audit Logging Write Path

```
User adds/removes/edits allowlist entry (via /api/allowlists/[id]/entries)
    ↓
Route handler calls prisma.allowlistEntry.create() / update() / delete()
    ↓
Prisma $use middleware intercepts (before: capture action + args)
    ↓
Original operation executes (next(params))
    ↓
Prisma $use middleware intercepts (after: result available)
    ↓
prisma.auditLog.create({
  model: 'AllowlistEntry',
  action: params.action,         // 'create' | 'update' | 'delete'
  recordId: result.id,
  actorId: userId from async context,
  before: params.args.where,
  after: result,
  timestamp: new Date()
})
```

**Hook point:** `prisma.$use()` registered once in `src/lib/prisma.ts` during client initialization. The actor (userId) must be passed via Node.js `AsyncLocalStorage` context because Prisma middleware does not receive HTTP request context.

---

## Suggested Build Order

Dependencies flow strictly from foundation to features. Building out of order causes rework.

```
Phase 1: Env Validation
    ↓ (env.ts exports typed config consumed by everything)
Phase 2: Encryption Module
    ↓ (encryption.ts must exist before OAuth callback is modified)
Phase 3: Token Encryption Integration
    ↓ (tokens must be encrypted before rate limiting needs to read userId from session)
Phase 4: Webhook Hardening
    ↓ (webhook changes are independent of audit logging)
Phase 5: Rate Limiting Middleware
    ↓ (middleware reads session cookie, not DB — no dependency on encryption)
Phase 6: Audit Log Schema + Prisma Middleware
    ↓ (schema migration must precede $use registration)
Phase 7: Test Coverage
    (tests verify all hardened paths)
```

**Rationale for order:**

1. **Env validation first** — every subsequent module benefits immediately; catches missing secrets before any other code runs. Zod already exists as a dependency.

2. **Encryption before token integration** — pure utility with no external dependencies (Node.js `crypto` only). Must exist before any code that calls `encrypt()` / `decrypt()`.

3. **Token encryption before rate limiting** — the rate limiting middleware can optionally decode the session cookie to get userId for per-user limits, but this is not required. Rate limiting can use IP only and be built independently. However, OAuth callback must be stable before touching other auth paths.

4. **Webhook hardening independent** — timestamp tolerance and timing-safe email comparison are pure logic changes with no new dependencies. Can be done in parallel with rate limiting.

5. **Rate limiting** — requires a decision on Redis (Upstash, Railway Redis addon) vs. in-memory. Next.js middleware runs before route handlers — straightforward integration once the rate store is decided.

6. **Audit logging last** — requires a new Prisma model (`AuditLog`) and migration. Schema migrations carry deployment risk and should be done after the stateless security layers are solid. `AsyncLocalStorage` for actor context adds complexity.

7. **Tests throughout** — each phase should be tested immediately. Webhook signature tests, token encryption round-trips, and rate limit behavior are all testable in Vitest.

---

## Architectural Patterns

### Pattern 1: Transparent Encryption Envelope

**What:** Encrypt sensitive fields before persistence and decrypt after read. Callers never handle raw plaintext tokens — only the encrypt/decrypt layer does. The database column stores a serialized envelope: `{ iv, ciphertext, authTag }` base64-encoded.

**When to use:** OAuth tokens, API keys, or any credential stored in the database. NOT for fields that need to be queried/searched (encryption makes WHERE clauses impossible without a separate hash index).

**Trade-offs:** Cannot query on encrypted values; token length increases ~30% due to base64 encoding; decryption failure must be handled gracefully.

**Example:**
```typescript
// src/lib/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex') // 32-byte hex key

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  })
}

export function decrypt(envelope: string): string {
  const { iv, ciphertext, authTag } = JSON.parse(envelope)
  const decipher = crypto.createDecipheriv(
    ALGORITHM, KEY, Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
```

**Integration:** Call `encrypt()` in `callback/route.ts` before `prisma.user.create/update`. Call `decrypt()` in `calendlyRequest()` and `cancelBookingWithRetry()` before using the token.

---

### Pattern 2: Middleware-Level Rate Limiting (Sliding Window)

**What:** Next.js `middleware.ts` intercepts all matching requests before they reach route handlers. Rate limit state is stored in Redis (Upstash for Vercel compatibility) or in-memory LRU (dev/Railway fallback). Sliding window algorithm prevents burst attacks while allowing sustained legitimate traffic.

**When to use:** All authenticated API routes. Not for webhook endpoints — Calendly and Stripe have dynamic IP ranges; rate limiting by IP would produce false positives.

**Trade-offs:** Middleware runs at the Edge by default in Next.js 15 — Redis client must use HTTP-based client (Upstash's `@upstash/ratelimit` uses fetch, not TCP). If using Railway Redis, must switch middleware to Node.js runtime (`export const runtime = 'nodejs'`).

**Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: false,
})

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const path = request.nextUrl.pathname

  const identifier = `${ip}:${path}`
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/api/allowlists/:path*',
    '/api/settings/:path*',
    '/api/billing/:path*',
    '/api/dashboard/:path*',
    // Intentionally EXCLUDES /api/webhooks/:path* — signature verification is the gate
  ],
}
```

---

### Pattern 3: Prisma Middleware for Audit Logging

**What:** Register a `$use` callback on the Prisma client singleton. The callback runs for every Prisma operation and can inspect model name, action type, args, and result. Write an `AuditLog` record after mutations on sensitive models.

**When to use:** Allowlist entry creates, updates, and deletes. Security events (token refresh, session creation). NOT for read operations or BookingAttempt (which is itself the audit trail for bookings).

**Trade-offs:** Prisma middleware does not receive HTTP request context (no `req` object). Actor identity (userId) must be passed via Node.js `AsyncLocalStorage`. Adds latency to every write operation. Prisma v5 still supports `$use` but marks it as a legacy API — `$extends` with query extensions is the newer approach.

**Example (using $use — Prisma 5 compatible):**
```typescript
// src/lib/prisma.ts (modified)
import { AsyncLocalStorage } from 'async_hooks'

export const auditContext = new AsyncLocalStorage<{ userId: string }>()

const client = new PrismaClient({ ... })

const AUDITED_MODELS = ['Allowlist', 'AllowlistEntry']
const AUDITED_ACTIONS = ['create', 'update', 'delete']

client.$use(async (params, next) => {
  const result = await next(params)

  if (
    AUDITED_MODELS.includes(params.model ?? '') &&
    AUDITED_ACTIONS.includes(params.action)
  ) {
    const ctx = auditContext.getStore()
    // Fire-and-forget — don't block the original operation
    client.auditLog.create({
      data: {
        model: params.model!,
        action: params.action,
        actorId: ctx?.userId ?? null,
        recordId: result?.id ?? null,
        payload: JSON.stringify(params.args),
        createdAt: new Date(),
      },
    }).catch(console.error)
  }

  return result
})
```

**Route handler wraps DB operations with context:**
```typescript
// src/app/api/allowlists/[id]/entries/route.ts
import { auditContext } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  // ... validation ...

  return auditContext.run({ userId: user.id }, async () => {
    return await prisma.allowlistEntry.create({ data: { ... } })
  })
}
```

---

### Pattern 4: Zod Env Validation at Startup

**What:** A single module (`src/lib/env.ts`) defines a Zod schema for all required environment variables and calls `z.parse(process.env)` at module load time. Exporting the parsed result as `env` gives typed access to all vars throughout the codebase.

**When to use:** Always. The cost is negligible (runs once at startup) and prevents the class of bugs where undefined env vars cause silent failures at runtime.

**Trade-offs:** Any module that imports `env.ts` will trigger startup validation — import order matters. Must be the first import in foundational modules (`prisma.ts`, `session.ts`).

**Example:**
```typescript
// src/lib/env.ts
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 32 bytes (64 hex chars)'),
  CALENDLY_CLIENT_ID: z.string().min(1),
  CALENDLY_CLIENT_SECRET: z.string().min(1),
  CALENDLY_REDIRECT_URI: z.string().url(),
  CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const env = schema.parse(process.env)
```

---

## Anti-Patterns

### Anti-Pattern 1: Rate Limiting Webhooks by IP

**What people do:** Apply the middleware rate limiter to `/api/webhooks/*` alongside other API routes.

**Why it's wrong:** Calendly and Stripe use CDN-distributed webhook delivery infrastructure with many source IPs. A 429 response to their webhook causes them to retry (often exponentially), which can cascade into further 429s and permanent webhook delivery failure.

**Do this instead:** Exclude webhook paths from the rate limiter matcher. The webhook signature verification (`verifyWebhookSignature()` + `isTimestampValid()`) is the correct security gate for those endpoints. Add idempotency key deduplication as a separate layer.

---

### Anti-Pattern 2: Encrypting at the ORM Level via Prisma Extensions

**What people do:** Use a Prisma extension to automatically encrypt/decrypt all reads and writes transparently at the ORM layer.

**Why it's wrong:** For a small set of fields (two token fields on User), a full ORM-level encryption extension adds complexity without benefit. It also makes the encryption boundary invisible to future developers and complicates debugging. More critically, Prisma 5's `$extends` query extensions that intercept `findMany` + `findUnique` results correctly are complex to implement without subtle bugs.

**Do this instead:** Encrypt explicitly at the two call sites where tokens are written (OAuth callback) and decrypt at the two call sites where tokens are read (calendlyRequest helper, cancelBookingWithRetry). Explicit > magic.

---

### Anti-Pattern 3: Generating ENCRYPTION_KEY at Runtime

**What people do:** Fall back to generating a random key if `ENCRYPTION_KEY` is missing, to avoid startup failures.

**Why it's wrong:** A new key is generated on every deployment (or process restart). All previously encrypted tokens become permanently undecryptable. Users cannot authenticate.

**Do this instead:** Env validation (Pattern 4) throws at startup if `ENCRYPTION_KEY` is missing. Provide clear error messaging. Generate the key once during setup with `openssl rand -hex 32` and store it permanently in the deployment's environment.

---

### Anti-Pattern 4: Logging Decrypted Tokens

**What people do:** Add console.log debugging around token decryption to trace issues.

**Why it's wrong:** OAuth tokens in logs are as dangerous as passwords in logs. Log aggregation systems (Vercel, Railway, Datadog) store logs for weeks/months and may ship them to third-party services.

**Do this instead:** Log token presence (boolean) and length only. Never log the decrypted value. The existing pattern `console.log('[Calendly] Signing key configured:', !!webhookSigningKey)` is the correct model.

---

## Integration Points

### External Services

| Service | Integration Pattern | Security Consideration |
|---------|---------------------|----------------------|
| Calendly OAuth | `/api/auth/calendly/callback` exchanges code for tokens | Tokens must be encrypted before `prisma.user.create/update` |
| Calendly Webhooks | `/api/webhooks/calendly` receives push events | HMAC-SHA256 signature + 60-second timestamp window; no rate limiting by IP |
| Stripe Webhooks | `/api/webhooks/stripe` receives billing events | Stripe signature via `stripe.webhooks.constructEvent()`; same: no IP rate limiting |
| Upstash Redis | `middleware.ts` for rate limit state | HTTP-based client required for Edge runtime; `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| PostgreSQL | Prisma client | AuditLog table added; encrypted token columns remain `String @db.Text` (no schema type change) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `env.ts` ↔ all lib modules | Module import (sync) | `env.ts` must be the first import; circular import risk if `env.ts` imports other lib modules |
| `encryption.ts` ↔ `calendly.ts` | Direct function call | `decrypt()` called in `calendlyRequest()` and `cancelBookingWithRetry()`; no Prisma dependency in encryption module |
| `middleware.ts` ↔ route handlers | HTTP — middleware returns early or calls `next()` | Middleware cannot read Prisma DB (no TCP in Edge runtime without switching to Node.js runtime) |
| `auditContext` ↔ route handlers | AsyncLocalStorage | Route handlers must wrap Prisma calls with `auditContext.run({ userId })` to populate actor for audit log |
| `$use` middleware ↔ `AuditLog` model | Prisma client internal | Audit writes use fire-and-forget (`.catch(console.error)`) to avoid blocking the original write |

---

## Scalability Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | In-memory rate limiting acceptable; Upstash free tier covers Redis; single Prisma instance |
| 1k-10k users | Upstash Redis for rate limiting (required for multi-instance Vercel deployments); audit log table will grow — add `createdAt` index |
| 10k+ users | Audit log archival strategy needed; consider separate audit database or log-shipping to dedicated store; encryption key rotation becomes a concern |

**First bottleneck:** The 4-second delay in webhook cancellation (`await new Promise(resolve => setTimeout(resolve, 4000))`) will hit Vercel's serverless function timeout (10s default, 30s on Pro) before database or rate limiting become issues. This is a pre-existing architectural concern noted here for context.

**Second bottleneck:** Audit log table growth. Every allowlist mutation writes a record. At high volume, `AuditLog` becomes the largest table. Mitigation: index on `(actorId, createdAt DESC)`, archive records older than 90 days.

---

## Build Order Implications for Roadmap

```
Phase 1 — Foundation (no external dependencies)
  ├── src/lib/env.ts              — Zod schema, typed env export
  └── src/lib/encryption.ts      — AES-256-GCM encrypt/decrypt, pure Node.js crypto

Phase 2 — Token Security (depends on Phase 1)
  ├── Modify callback/route.ts    — encrypt tokens on write
  ├── Modify calendly.ts          — decrypt tokens on read
  ├── Modify webhooks/calendly    — decrypt tokens before use
  └── Webhook hardening           — tighten timestamp tolerance, timing-safe comparison

Phase 3 — Rate Limiting (parallel with Phase 2)
  ├── middleware.ts               — Sliding window, IP-based
  └── Decide: Upstash Redis vs in-memory (impacts env vars needed)

Phase 4 — Audit Logging (depends on Phase 1 + running DB)
  ├── AuditLog model in schema.prisma
  ├── prisma migrate dev
  ├── AsyncLocalStorage context in prisma.ts
  ├── $use middleware registration
  └── Route handler context wrapping (allowlists entries routes)

Phase 5 — Test Coverage (depends on Phases 1-4)
  ├── Webhook signature tests
  ├── Encryption round-trip tests
  ├── Rate limit behavior tests
  └── Audit log write tests
```

**Critical dependency:** The `ENCRYPTION_KEY` environment variable must be generated and stored in Railway + Vercel environment settings before Phase 2 is deployed. Deploying Phase 2 without `ENCRYPTION_KEY` causes startup failure (by design — env validation).

---

## Sources

- Next.js 15 Middleware documentation — official docs (fetched 2026-02-20): execution order, matcher config, `NextFetchEvent.waitUntil()` for background tasks
- Codebase inspection — `src/lib/webhook.ts`, `src/lib/calendly.ts`, `src/lib/session.ts`, `src/lib/prisma.ts`, `prisma/schema.prisma`, `src/app/api/webhooks/calendly/route.ts`, `src/app/api/auth/calendly/callback/route.ts` (all read 2026-02-20)
- Node.js `crypto` module — AES-256-GCM API (training knowledge, HIGH confidence — stable API since Node.js 12)
- Prisma 5 `$use` middleware — training knowledge, MEDIUM confidence (Prisma 5 marks `$use` as legacy in favor of `$extends` query extensions, but `$use` remains functional; verify against Prisma 5.7 changelog before implementation)

---

*Architecture research for: Next.js 15 SaaS security hardening*
*Researched: 2026-02-20*

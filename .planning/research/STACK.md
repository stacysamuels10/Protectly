# Stack Research

**Domain:** Next.js SaaS security hardening (field-level encryption, env validation, rate limiting, audit logging, security testing)
**Researched:** 2026-02-20
**Confidence:** MEDIUM — versions drawn from installed package-lock.json and training knowledge; WebSearch/WebFetch unavailable during research session. All version claims below are flagged with their source.

---

## Context: What Already Exists

The existing stack is Next.js 15.1.3 / React 19 / Prisma 5.7.1 / PostgreSQL / TypeScript 5.3.3.
Already installed and relevant to security hardening:

| Package | Installed Version | Notes |
|---------|-------------------|-------|
| `zod` | 3.25.76 (from package-lock.json — HIGH confidence) | Already used for validation; extend to env vars |
| `iron-session` | 8.0.1 | Existing session management; harden rather than replace |
| `vitest` | 4.0.16 | Existing test runner; add security test suites |
| `@playwright/test` | 1.57.0 | Existing E2E runner |
| `crypto` | Node.js built-in | Already used in `src/lib/webhook.ts` for HMAC-SHA256 and `timingSafeEqual` |

The project has **no middleware.ts**, no rate-limiting layer, no encryption utility, no env validation at startup, and no audit log table.

---

## Recommended Stack

### 1. Field-Level Encryption

#### Recommendation: Node.js built-in `crypto` module — AES-256-GCM

**Why:** The project already imports `crypto` in `src/lib/webhook.ts`. AES-256-GCM provides authenticated encryption (prevents tampering, not just confidentiality), is the current NIST-recommended cipher for symmetric encryption, and requires zero new dependencies. This is the right choice for encrypting Calendly OAuth tokens (`calendlyAccessToken`, `calendlyRefreshToken`) before persisting them to PostgreSQL.

**Why NOT a third-party encryption library:**
- `@node-rs/bcrypt` is a password hashing library, not symmetric encryption — not appropriate for reversible token storage (tokens must be decrypted to be used with the Calendly API). CONCERNS.md incorrectly referenced it as a candidate.
- `node-forge` adds ~500KB and duplicates functionality available in Node.js built-ins since Node 10.
- `libsodium-wrappers` / `tweetnacl` are excellent but add dependencies unnecessarily when Node's `crypto.subtle` / `crypto.createCipheriv` provides the same primitives.

**Confidence: HIGH** — AES-256-GCM via Node.js `crypto` is the established standard for application-layer field encryption; no new package needed.

**Implementation pattern:**

```typescript
// src/lib/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes = 64 hex chars

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Store as: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

**New env var required:** `ENCRYPTION_KEY` — 32 random bytes as 64-character hex string.
Generate with: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`

**Schema impact:** `calendlyAccessToken` and `calendlyRefreshToken` fields in Prisma schema remain `String?` / `@db.Text` but will store the `iv:authTag:ciphertext` format. No migration needed — just re-encrypt on next token write.

---

### 2. Environment Variable Validation

#### Recommendation: `@t3-oss/env-nextjs` — wrapping the already-installed `zod`

| Package | Source | Version | Confidence |
|---------|--------|---------|------------|
| `@t3-oss/env-nextjs` | Training knowledge | ~0.10.x | MEDIUM — verify exact version on npm before installing |
| `zod` | package-lock.json | 3.25.76 (installed) | HIGH |

**Why `@t3-oss/env-nextjs` over raw `zod`:**
- Raw `zod` can validate env vars, but requires manual wiring to distinguish server-only vs client-safe vars — a distinction Next.js's App Router makes architecturally critical.
- `@t3-oss/env-nextjs` is purpose-built: it validates at build time AND runtime, throws on startup if required vars are missing (not at first use), and separates `server` / `client` namespaces matching Next.js's `NEXT_PUBLIC_` convention.
- The project's current pattern of `process.env.STRIPE_SECRET_KEY!` with TypeScript's non-null assertion means a missing var crashes at the call site deep in request handling — the worst possible failure mode. Startup validation catches this at boot.
- Zod 3.25.76 is already installed and `@t3-oss/env-nextjs` uses it as a peer dependency — no additional validation library needed.

**Confidence: MEDIUM** — `@t3-oss/env-nextjs` is the de facto standard for T3-stack-adjacent Next.js apps (high adoption, widely documented), but version was not confirmed against npm during this session.

**Why NOT alternatives:**
- `dotenv-safe` — validates `.env` file presence but not value shapes; no TypeScript types; no Next.js integration.
- `envalid` — good library but no native Next.js client/server split; adds its own validator DSL on top of what zod already provides.
- Raw `zod` at module top-level — works, but no build-time check and requires each `lib/*.ts` file to independently guard itself.

**Implementation pattern:**

```typescript
// src/env.ts  (imported once at app startup; Next.js runs this on module load)
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/),
    CALENDLY_CLIENT_ID: z.string().min(1),
    CALENDLY_CLIENT_SECRET: z.string().min(1),
    CALENDLY_REDIRECT_URI: z.string().url(),
    CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    STRIPE_PRICE_PRO_MONTHLY: z.string().startsWith('price_'),
    STRIPE_PRICE_PRO_YEARLY: z.string().startsWith('price_'),
    STRIPE_PRICE_BUSINESS_MONTHLY: z.string().startsWith('price_'),
    STRIPE_PRICE_BUSINESS_YEARLY: z.string().startsWith('price_'),
    NODE_ENV: z.enum(['development', 'test', 'production']),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    // ... etc
  },
})
```

**Installation:**
```bash
npm install @t3-oss/env-nextjs
# zod already installed at 3.25.76
```

---

### 3. Rate Limiting

#### Recommendation: `@upstash/ratelimit` + `@upstash/redis` for production; in-memory map for development

| Package | Source | Version | Confidence |
|---------|--------|---------|------------|
| `@upstash/ratelimit` | Training knowledge | ~2.x | MEDIUM — verify on npm |
| `@upstash/redis` | Training knowledge | ~1.x | MEDIUM — verify on npm |

**Why `@upstash/ratelimit`:**
- Vercel Edge / Next.js App Router routes run in the Edge Runtime or Node.js serverless functions — neither has shared in-process memory between requests. A traditional in-memory rate limiter (e.g., `express-rate-limit`, `node-rate-limiter-flexible` without Redis) is useless in a serverless/edge environment because each invocation gets a fresh process.
- `@upstash/ratelimit` is the standard solution for Vercel + Next.js deployments: it uses Redis (serverless-compatible via Upstash's HTTP Redis API) and supports sliding window and fixed window algorithms without a persistent TCP connection.
- The project deploys to Vercel (primary) and Railway (secondary). Upstash Redis works in both environments. Railway also supports a managed Redis addon if preferred.
- The alternative — `next-rate-limit` or `rate-limiter-flexible` — both require a shared state store anyway. Upstash just bundles the Redis client cleanly.

**Why NOT alternatives:**
- `express-rate-limit` — Express middleware; incompatible with Next.js App Router route handlers.
- `rate-limiter-flexible` (node-rate-limiter-flexible) — works but requires separate Redis client setup; more boilerplate; not edge-native.
- In-memory `Map` with sliding window — works in development/testing only; silently fails in production (resets on every cold start, doesn't count across instances).

**Confidence: MEDIUM** — Upstash is documented in Vercel's official examples; edge-compatible rate limiting via Redis is the accepted pattern, but the exact package version was not confirmed from npm during this session.

**Implementation pattern:**

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Graceful degradation: if Upstash not configured, skip rate limiting (dev/test)
const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 req/min default
      analytics: false,
    })
  : null

export async function checkRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  if (!ratelimit) return { success: true, remaining: 999 }
  const result = await ratelimit.limit(identifier)
  return { success: result.success, remaining: result.remaining }
}
```

**Rate limit configuration by endpoint:**
- Webhook endpoints (`/api/webhooks/*`): 100/min per IP (Calendly/Stripe retry patterns are bursty)
- Auth endpoints (`/api/auth/*`): 10/min per IP
- Allowlist mutation (`POST/DELETE /api/allowlists/*`): 30/min per user
- Read endpoints: 120/min per user

**New env vars required:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Installation:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

---

### 4. Audit Logging

#### Recommendation: Prisma-native database table — no additional library

**Why database-native audit logging:**
- The project has no message queue, no log aggregation service, and no external logging pipeline. Adding `pino`, `winston`, or a cloud logging SDK creates operational complexity without corresponding benefit at this stage.
- Audit events for this project are business-level events (allowlist add/remove/import, settings changes, admin actions) — not system telemetry. These belong in PostgreSQL where they can be queried by the application (e.g., "show me all changes to this allowlist").
- Prisma middleware / `$extends` provides a clean hook point to write audit records without scattering audit calls across route handlers.

**Why NOT alternatives:**
- `pino` / `winston` — excellent for structured logging to stdout/files, but stdout logs in Vercel are not queryable; logs are lost between deployments. No way to answer "who added this email at 3pm Tuesday?"
- Datadog / Logtail / Axiom — overkill for this stage; adds cost and external service dependency.
- `prisma-audit-trails` (community package) — not widely maintained; rolling our own Prisma middleware is 30 lines of code vs. adding an untested dependency.

**Confidence: HIGH** — database-native audit trail via a new Prisma model is established SaaS practice for this type of application.

**Implementation pattern:**

```prisma
// prisma/schema.prisma — new model
model AuditLog {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  action      AuditAction
  entityType  String    @db.VarChar(50)   // "AllowlistEntry", "Allowlist", "User", "Settings"
  entityId    String?   @db.VarChar(255)  // ID of the affected record
  oldValue    Json?                        // Previous state (GDPR: exclude PII if possible)
  newValue    Json?                        // New state
  ipAddress   String?   @db.VarChar(45)   // IPv4 or IPv6
  userAgent   String?   @db.Text

  createdAt   DateTime  @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([entityType, entityId])
  @@map("audit_logs")
}

enum AuditAction {
  ALLOWLIST_ENTRY_ADDED
  ALLOWLIST_ENTRY_REMOVED
  ALLOWLIST_ENTRY_BULK_IMPORTED
  ALLOWLIST_CREATED
  ALLOWLIST_DELETED
  SETTINGS_UPDATED
  GUEST_CHECK_MODE_CHANGED
  CANCEL_MESSAGE_UPDATED
  TOKEN_REFRESHED
  ACCOUNT_DELETED
}
```

```typescript
// src/lib/audit.ts
import { prisma } from './prisma'
import type { AuditAction } from '@prisma/client'

export async function writeAuditLog(params: {
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  // Fire-and-forget: don't let audit failure block the main operation
  void prisma.auditLog.create({ data: params }).catch((err) => {
    console.error('[AuditLog] Failed to write audit record:', err)
  })
}
```

---

### 5. Webhook Idempotency

#### Recommendation: Idempotency key column on `BookingAttempt` — Prisma native

**Why:** No new library needed. Adding a `calendlyEventUri` + deduplication check (or a dedicated `idempotencyKey` column with a unique index) to the `BookingAttempt` model prevents duplicate processing. The project already records `calendlyEventUri` — a unique index on that field is sufficient for Calendly webhooks. For Stripe, use the Stripe event ID.

**Confidence: HIGH** — idempotency via unique constraint is a database primitive; no library required.

**Schema change:**
```prisma
model BookingAttempt {
  // ...existing fields...
  calendlyEventUri String?  @db.VarChar(500) @unique  // ADD @unique
  stripeEventId    String?  @db.VarChar(255) @unique  // NEW for Stripe idempotency
}
```

---

### 6. Security Testing

#### Recommendation: Vitest (existing) for unit security tests; no new testing frameworks

The project already has Vitest 4.0.16 + Playwright 1.57.0. The test gap is not tooling — it's coverage. No new testing libraries are needed.

**What to add within existing tooling:**

**Vitest security test suites (new files, no new deps):**
- `src/lib/webhook.test.ts` — signature verification (valid, invalid key, missing header, tampered payload, expired timestamp, boundary conditions)
- `src/lib/encryption.test.ts` — encrypt/decrypt roundtrip, wrong key rejection, IV uniqueness, auth tag validation
- `src/app/api/webhooks/calendly/route.test.ts` — duplicate event idempotency, allowlist enforcement per guest mode
- `src/app/api/allowlists/__tests__/permissions.test.ts` — cross-user access rejection, userId enforcement

**For HTTP-level security scanning:**
One lightweight addition is recommended for CI:

| Tool | Type | Version | Purpose | Confidence |
|------|------|---------|---------|------------|
| `zap-cli` or OWASP ZAP in CI | DAST scanner | n/a | Automated security scan against running app | LOW — assess CI feasibility before adding |

**Why NOT dedicated security testing libraries:**
- `jest-circus` / `@jest/globals` — project uses Vitest; don't add Jest.
- `supertest` — for route handler testing, but Next.js App Router route handlers are not Express handlers; use `Request`/`Response` objects directly in Vitest instead.
- `msw` (Mock Service Worker) — useful for mocking outbound HTTP (Calendly/Stripe API), but not specifically a security tool; LOW priority for this milestone.

**Confidence for Vitest-only approach: HIGH** — existing tooling is sufficient; test coverage gaps are the problem, not the tools.

---

### 7. Timing-Safe Email Comparison

#### Recommendation: Node.js built-in `crypto.timingSafeEqual` — already imported

**Why:** The fix for the timing attack vulnerability in `src/app/api/webhooks/calendly/route.ts` and `src/app/api/allowlists/[id]/entries/route.ts` requires wrapping email `.includes()` checks with constant-time comparison. `crypto.timingSafeEqual` is already imported in the project for webhook signature verification. No new package needed.

**Confidence: HIGH** — using the already-imported Node.js crypto module.

---

## Core Technologies Table

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `crypto` (Node.js built-in) | Node 18+ built-in | Field-level AES-256-GCM encryption for OAuth tokens | No deps; GCM provides authenticated encryption; already imported | HIGH |
| `@t3-oss/env-nextjs` | ~0.10.x (verify) | Startup env validation with server/client split | Zod-powered; built for Next.js; catches missing vars at boot not at request time | MEDIUM |
| `zod` | 3.25.76 (installed) | Schema validation within env.ts | Already installed; peer dep for @t3-oss/env-nextjs | HIGH |
| `@upstash/ratelimit` | ~2.x (verify) | Sliding window rate limiting | Edge/serverless compatible via HTTP Redis; no persistent connection | MEDIUM |
| `@upstash/redis` | ~1.x (verify) | Redis client for Upstash | Serverless-native HTTP client; pairs with @upstash/ratelimit | MEDIUM |
| Prisma `AuditLog` model | existing Prisma 5.7.1 | Database-native audit trail | Queryable by app; no external service; survives deployments | HIGH |
| Vitest (existing) | 4.0.16 (installed) | Security unit test suites | Already configured; add test files, not new tooling | HIGH |

---

## Supporting Libraries Table

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` built-in | Node 18 built-in | `timingSafeEqual`, `randomBytes`, `createCipheriv` | All encryption and timing-safe operations |
| `@t3-oss/env-nextjs` | ~0.10.x | Import `env` object from `src/env.ts` instead of `process.env` | All access to environment variables |
| `@upstash/ratelimit` | ~2.x | `checkRateLimit()` helper | All API route handlers via middleware or inline |
| `@upstash/redis` | ~1.x | Redis client for rate limiter | Only when `UPSTASH_REDIS_REST_URL` is set |

---

## Installation

```bash
# Env validation (zod already installed)
npm install @t3-oss/env-nextjs

# Rate limiting (requires Upstash Redis account — free tier available)
npm install @upstash/ratelimit @upstash/redis

# No new packages needed for:
# - Field-level encryption (Node.js crypto built-in)
# - Audit logging (Prisma model addition)
# - Security testing (Vitest already installed)
# - Timing-safe comparisons (Node.js crypto built-in)
```

**New environment variables to add:**
```bash
# Required for encryption
ENCRYPTION_KEY=<64-char hex, generate: node -e "require('crypto').randomBytes(32).toString('hex')|xargs echo">

# Required for rate limiting (production)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Existing — now required (remove fallbacks)
SESSION_SECRET=<32+ char random string, no fallback>
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `crypto` built-in AES-256-GCM | `node-forge` | Duplicates built-in; adds ~500KB bundle weight; no advantage |
| `crypto` built-in AES-256-GCM | `@node-rs/bcrypt` | Wrong primitive — bcrypt is one-way hashing; tokens must be reversibly decrypted |
| `crypto` built-in AES-256-GCM | `libsodium-wrappers` | Adds native binary dep; overkill when Node crypto handles AES-256-GCM natively |
| `@t3-oss/env-nextjs` | Raw `zod` at module init | No build-time check; no client/server split; doesn't fail fast at startup |
| `@t3-oss/env-nextjs` | `envalid` | Its own validator DSL; doesn't leverage existing zod; no Next.js-aware split |
| `@t3-oss/env-nextjs` | `dotenv-safe` | Checks file presence only, not value shapes; no TypeScript types |
| `@upstash/ratelimit` | `express-rate-limit` | Express middleware API; incompatible with Next.js App Router route handlers |
| `@upstash/ratelimit` | `rate-limiter-flexible` | Requires own Redis client; no edge-native HTTP client; more boilerplate |
| `@upstash/ratelimit` | In-memory Map | Resets on cold start; broken across multiple instances; silent failure in production |
| Prisma AuditLog model | `pino` / `winston` | stdout logs not queryable; lost between Vercel deployments; wrong abstraction level |
| Prisma AuditLog model | `prisma-audit-trails` (community) | Poorly maintained; 30 lines of native Prisma middleware replaces it cleanly |
| Vitest (existing) | `supertest` | Express-specific; Next.js App Router handlers use Web `Request`/`Response` objects |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@node-rs/bcrypt` for token encryption | One-way hash — tokens cannot be decrypted for API use | `crypto.createCipheriv` with AES-256-GCM |
| `express-rate-limit` | Stateful Express middleware; cannot share state across serverless invocations | `@upstash/ratelimit` |
| `helmet` | Express/Connect middleware for HTTP headers; Next.js sets security headers via `next.config.js` | Next.js `headers()` config in `next.config.js` |
| Any in-memory rate limiter without Redis | Silently resets per cold start in Vercel serverless; appears to work locally | `@upstash/ratelimit` with Redis |
| Storing encryption key in database | Defeats the purpose — if DB is compromised, key is also compromised | Environment variable (`ENCRYPTION_KEY`) only |
| Re-using the same IV for AES-GCM | Catastrophic security failure; GCM with repeated IV leaks the key | Always `crypto.randomBytes(12)` per encryption call |
| Logging decrypted token values | Logs are lower-security than DB; defeats encryption goal | Log only token presence/absence, never values |

---

## Stack Patterns by Variant

**For development / local testing (no Upstash account):**
- Rate limiter degrades gracefully when `UPSTASH_REDIS_REST_URL` is unset (check in `src/lib/rate-limit.ts`)
- Encryption works identically — `ENCRYPTION_KEY` must still be set (use any 64-char hex string locally)
- Audit log writes to local PostgreSQL normally

**For CI (GitHub Actions / testing):**
- Rate limiter mock: return `{ success: true, remaining: 999 }` in test environment
- Encryption: generate a test `ENCRYPTION_KEY` in CI env vars
- Audit log: write to test database or mock `prisma.auditLog.create`

**For production (Vercel + Railway):**
- Set all env vars in Vercel dashboard and Railway variables panel
- Upstash Redis free tier supports ~10K requests/day — sufficient for early SaaS usage
- `@t3-oss/env-nextjs` validation fires at `next build` time — build fails if vars missing

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@t3-oss/env-nextjs` ~0.10.x | `zod` 3.x | Peer dep; installed zod 3.25.76 satisfies this |
| `@t3-oss/env-nextjs` ~0.10.x | Next.js 15.x | Explicitly supports App Router |
| `@upstash/ratelimit` ~2.x | `@upstash/redis` ~1.x | Must be used together; don't mix ioredis with @upstash/ratelimit |
| `@upstash/ratelimit` ~2.x | Next.js Edge Runtime | HTTP-based client; no TCP; Edge-compatible |
| Node.js `crypto` AES-256-GCM | Node.js 18+ | Fully stable in Node 18 LTS; project likely uses 18 or 20 (check `.nvmrc`) |
| Prisma 5.7.1 | PostgreSQL 14+ | New `AuditLog` model requires a Prisma migration; compatible with current schema |

---

## Sources

- `package-lock.json` (project root) — confirmed installed versions of `zod` (3.25.76), `vitest` (4.0.16), `iron-session` (8.0.1), `prisma` (5.7.1), `next` (15.1.3) — HIGH confidence
- `.planning/codebase/STACK.md` — current technology inventory — HIGH confidence
- `.planning/codebase/CONCERNS.md` — security issues to address — HIGH confidence
- `src/lib/webhook.ts`, `src/lib/session.ts`, `src/lib/stripe.ts`, `src/lib/calendly.ts` — direct code inspection — HIGH confidence
- `prisma/schema.prisma` — schema structure — HIGH confidence
- Training knowledge (cutoff Aug 2025) for `@t3-oss/env-nextjs`, `@upstash/ratelimit`, `@upstash/redis` ecosystem patterns — MEDIUM confidence; versions should be verified against npm before installation
- Node.js 18 `crypto` module documentation (AES-256-GCM) — HIGH confidence; NIST-standardized algorithm, stable API since Node 10

---

*Stack research for: Protectly security hardening milestone*
*Researched: 2026-02-20*
*Confidence note: WebSearch and WebFetch were unavailable during this research session. All library ecosystem claims (adoption patterns, version numbers for new packages) are based on training knowledge and flagged MEDIUM. All claims derived from project files (package-lock.json, source code) are HIGH confidence. Verify @t3-oss/env-nextjs, @upstash/ratelimit, and @upstash/redis current versions on npmjs.com before installation.*

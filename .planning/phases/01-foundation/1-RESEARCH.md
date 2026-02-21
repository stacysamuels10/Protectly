# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Next.js 15 startup env validation + AES-256-GCM encryption primitive setup
**Confidence:** HIGH

---

## Summary

Phase 1 establishes two hard dependencies that all downstream phases rely on: (1) a typed, Zod-validated environment object that replaces scattered `process.env.*!` non-null assertions across the codebase, and (2) a pure encryption utility module (`src/lib/encryption.ts`) using Node.js's built-in `crypto` module with AES-256-GCM. Both are purely additive — no existing routes, schemas, or data are modified in this phase.

The codebase currently uses `process.env.*` directly in seven `src/lib/*.ts` files and at least six API route files, with no validation at startup. The most critical security gap addressed by this phase is the conditional webhook signature verification in `src/app/api/webhooks/calendly/route.ts` (line 66): `if (webhookSigningKey) { ... }` — if `CALENDLY_WEBHOOK_SIGNING_KEY` is missing, all webhooks are accepted without verification. Making this key required in the env schema (and failing fast at startup) closes this gap.

The SESSION_SECRET weakness is the second critical issue: `src/lib/session.ts` casts `process.env.SESSION_SECRET as string` with no validation. The `.env.local` file currently has a hardcoded development value (`this_is_a_development_secret_key_change_in_production_32chars`). Env validation must enforce `min(32)` and remove any ability to proceed without a real secret.

**Primary recommendation:** Create `src/env.ts` using `@t3-oss/env-nextjs@0.13.10` (wrapping the already-installed `zod@3.25.76`), then create `src/lib/encryption.ts` using Node.js `crypto` built-in. Update all `src/lib/*.ts` files to import from `env` instead of `process.env`. No new runtime dependencies beyond `@t3-oss/env-nextjs` — everything else uses what is already installed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-01 | Application validates all required environment variables at startup using zod schema and fails fast with clear error messages if any are missing | `@t3-oss/env-nextjs` calls `createEnv()` at module load time; importing `env` from any lib file triggers validation before any request handler runs; zod provides field-level error messages naming the missing var |
| ENV-02 | SESSION_SECRET weak fallback is removed — app refuses to start without a valid SESSION_SECRET in all environments | `SESSION_SECRET: z.string().min(32)` in the server schema combined with no `.default()` or `.optional()` means startup throws if missing or too short; `src/lib/session.ts` must import from `env` instead of `process.env` |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@t3-oss/env-nextjs` | 0.13.10 (latest, verified on npm 2026-02-20) | Startup env validation with Next.js server/client namespace separation | Purpose-built for App Router; validates at build time AND runtime; single source of truth for all env vars; peer dep on already-installed zod 3.25.76 |
| `zod` | 3.25.76 (already installed) | Schema definition for env vars | Already in project; peer dep for @t3-oss/env-nextjs; no version conflict (`^3.24.0` satisfied) |
| `crypto` (Node.js built-in) | Node 18+ built-in | AES-256-GCM encrypt/decrypt for OAuth tokens | No new dependency; GCM provides authenticated encryption (prevents both tampering AND confidentiality breach); already imported in `src/lib/webhook.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto.randomBytes` | Built-in | Generate 12-byte IV per encryption call | Every `encrypt()` invocation — NEVER reuse an IV with AES-GCM |
| TypeScript `satisfies` operator | 5.3.3 (installed) | Type narrowing on env object | In `src/env.ts` if manual `runtimeEnv` mapping needs type checking |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@t3-oss/env-nextjs` | Raw `zod` at module top-level | Raw zod works but has no Next.js build-time check; no server/client split; each lib file would need its own guard; no single startup failure point |
| `@t3-oss/env-nextjs` | `envalid` | envalid has its own validator DSL, doesn't leverage existing zod, no App Router integration |
| `crypto` AES-256-GCM | `libsodium-wrappers` | Adds native binary dep; no advantage over Node built-in for this use case |
| `crypto` AES-256-GCM | `bcrypt`/`argon2` | WRONG — one-way hashes; tokens must be reversibly decrypted for API use |

**Installation:**
```bash
npm install @t3-oss/env-nextjs
# zod@3.25.76 already installed — satisfies peer dep ^3.24.0
# crypto is a Node.js built-in — no install needed
```

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── env.ts                    # NEW — single env validation module; imported everywhere
├── lib/
│   ├── encryption.ts         # NEW — AES-256-GCM encrypt/decrypt; pure Node.js crypto
│   ├── session.ts            # MODIFY — import env.SESSION_SECRET instead of process.env
│   ├── stripe.ts             # MODIFY — import env.STRIPE_SECRET_KEY etc.
│   ├── calendly.ts           # MODIFY — import env.CALENDLY_* vars
│   ├── prisma.ts             # MODIFY — import env.DATABASE_URL (optional but consistent)
│   └── webhook.ts            # NO CHANGE in Phase 1 (timestamp tolerance is Phase 2)
└── app/
    └── api/
        └── webhooks/
            └── calendly/
                └── route.ts  # MODIFY — env.CALENDLY_WEBHOOK_SIGNING_KEY (required, non-conditional)
```

### Pattern 1: Typed Env Object with @t3-oss/env-nextjs

**What:** `createEnv()` from `@t3-oss/env-nextjs` validates all env vars at module load time. The exported `env` object is fully typed — `env.SESSION_SECRET` is `string`, not `string | undefined`. Any missing required var throws a `ZodError` with clear field-level messaging before the app accepts any request.

**When to use:** All access to environment variables — replace every `process.env.FOO!` and `process.env.FOO as string` in `src/lib/*.ts` and `src/app/api/**/*.ts`.

**Example:**
```typescript
// src/env.ts
// Source: @t3-oss/env-nextjs@0.13.10 docs
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
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
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
    CALENDLY_REDIRECT_URI: process.env.CALENDLY_REDIRECT_URI,
    CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_BUSINESS_MONTHLY: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    STRIPE_PRICE_BUSINESS_YEARLY: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
})
```

**Critical note on `runtimeEnv`:** `@t3-oss/env-nextjs` requires explicit `runtimeEnv` mapping — it cannot read `process.env` automatically due to Next.js's static analysis of env var usage. Every key in `server` and `client` must appear in `runtimeEnv`.

### Pattern 2: AES-256-GCM Encryption Module

**What:** A pure utility module with no Prisma/session/HTTP dependencies. `encrypt()` takes a plaintext string and returns a serialized envelope. `decrypt()` reverses it. The `ENCRYPTION_KEY` is read from `env.ENCRYPTION_KEY` (the validated env object), so if the key is missing the app already fails before this module is used.

**When to use:** This module is created in Phase 1 but not integrated into token storage until Phase 2. Phase 1 just establishes the primitive so Phase 2 can import it without circular dependency risk.

**Example:**
```typescript
// src/lib/encryption.ts
import crypto from 'crypto'
import { env } from '@/env'

const ALGORITHM = 'aes-256-gcm'

// Read key once at module load time — env validation already confirmed it exists and is 64 hex chars
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex') // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12) // 96-bit IV required for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag() // 128-bit authentication tag
  // Version-prefixed format enables future key rotation
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(envelope: string): string {
  if (!envelope.startsWith('enc:v1:')) {
    throw new Error('Invalid encryption envelope format or unsupported version')
  }
  const [, , ivHex, authTagHex, ciphertextHex] = envelope.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

**Version prefix rationale:** Storing `enc:v1:` prefix allows future key rotation — a background job can identify which rows use the old key by looking for `enc:v1:` vs `enc:v2:` prefix, without adding a separate schema column.

### Pattern 3: Updating Consumers of process.env

**What:** After `src/env.ts` is created, all `src/lib/*.ts` files and relevant API routes replace raw `process.env` access with imports from `env`. This ensures the typed, validated object is the single access path.

**Files that require updates in Phase 1:**
- `src/lib/session.ts` — `process.env.SESSION_SECRET as string` → `env.SESSION_SECRET`
- `src/lib/stripe.ts` — 5 `process.env.STRIPE_*!` usages → `env.STRIPE_*`
- `src/lib/calendly.ts` — 4 `process.env.CALENDLY_*` usages → `env.CALENDLY_*`
- `src/app/api/webhooks/calendly/route.ts` — `process.env.CALENDLY_WEBHOOK_SIGNING_KEY` conditional → `env.CALENDLY_WEBHOOK_SIGNING_KEY` (unconditional — startup guarantees it exists)

**Note on `src/lib/prisma.ts`:** It uses `process.env.NODE_ENV` for log level. Since `NODE_ENV` has a `.default('development')` in the schema, this is safe to update but low priority. The `DATABASE_URL` is used by Prisma internally via its own env reading — Prisma reads `DATABASE_URL` directly from `process.env`, not from `env.*`. Do NOT try to inject `env.DATABASE_URL` into the Prisma client constructor; Prisma handles this itself.

### Anti-Patterns to Avoid

- **`if (webhookSigningKey)` guards:** The conditional in `src/app/api/webhooks/calendly/route.ts` that skips signature verification when the env var is missing MUST be removed. With env validation at startup, `env.CALENDLY_WEBHOOK_SIGNING_KEY` is always a non-empty string when the app is running — no guard needed.
- **`.default()` on security-critical vars:** Do not add `.default('somevalue')` to `SESSION_SECRET`, `ENCRYPTION_KEY`, or `CALENDLY_WEBHOOK_SIGNING_KEY`. A default defeats fail-fast behavior.
- **`.optional()` on any security-critical var:** Same reasoning — optional allows undefined, which means the security property is not enforced.
- **Circular imports through env.ts:** `src/env.ts` must NOT import from `src/lib/prisma.ts`, `src/lib/session.ts`, or any other lib file. It is a leaf module that only imports from `@t3-oss/env-nextjs` and `zod`.
- **Importing env.ts inside a function body:** The validation must run at module load time (top-level import), not lazily inside request handlers. `import { env } from '@/env'` at the top of each file is correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server/client env namespace separation | Custom validation that runs only at runtime | `@t3-oss/env-nextjs` `server`/`client` split | Next.js App Router has hard rules about which vars reach the browser; manual splitting is error-prone |
| Build-time validation of env vars | CI script that checks env file | `@t3-oss/env-nextjs` — triggers during `next build` | Build fails immediately before deployment if vars are missing; no custom CI step needed |
| AES-256-GCM cipher | Any custom cipher implementation | `crypto.createCipheriv('aes-256-gcm', ...)` | NIST-standardized; stable since Node 10; no dependencies; GCM provides authenticated encryption (rejects tampering) |
| IV management | Static IV or IV derived from key | `crypto.randomBytes(12)` per call | Reusing an IV with AES-GCM is catastrophic — leaks the keystream; randomBytes ensures uniqueness |

**Key insight:** The value of `@t3-oss/env-nextjs` is not the validation logic (zod handles that) — it's the integration with Next.js's static analysis at build time and the architectural convention of a single `env` object. The alternative (hand-rolling module-level `z.parse(process.env)`) misses the build-time check and scatters validation across files.

---

## Common Pitfalls

### Pitfall 1: ENCRYPTION_KEY Not Added to Local and CI Environments

**What goes wrong:** Developer creates `src/env.ts` with `ENCRYPTION_KEY` as required. App immediately fails to start locally because `.env.local` doesn't have it. Team wastes time debugging an expected error.

**Why it happens:** `ENCRYPTION_KEY` is a new variable — it doesn't exist in `.env.local` or CI environment config yet. The schema validation correctly rejects startup, but if developers don't read the error message, they chase the wrong cause.

**How to avoid:** The planner should include a task to generate the key and add it to `.env.local` BEFORE the env schema is added. Order: (1) generate key locally, (2) create env.ts with the key required, (3) run `npm run dev` to verify startup succeeds. In CI, add `ENCRYPTION_KEY` to GitHub Actions secrets before the test run.

**Warning signs:** `ZodError: ENCRYPTION_KEY: Required` at startup after adding the schema.

---

### Pitfall 2: Removing the process.env Fallback Breaks Iron-Session Cookie Validation

**What goes wrong:** `src/lib/session.ts` passes `process.env.SESSION_SECRET as string` to iron-session. Switching to `env.SESSION_SECRET` is safe IF the value in the environment matches what was previously used. If the running environment had no `SESSION_SECRET` set (iron-session was silently receiving `undefined`, cast to string), switching to the validated value with a new real secret invalidates all existing sessions.

**Why it happens:** The existing `.env.local` has a 57-character development secret (`this_is_a_development_secret_key_change_in_production_32chars`). This is a real value, not undefined. As long as production environments already have `SESSION_SECRET` set to the same consistent value, switching to env validation does not invalidate sessions. The risk is if any production or staging environment has `SESSION_SECRET` unset.

**How to avoid:** Before deploying, audit all environments (Railway production, Railway staging, Vercel production, Vercel preview) to confirm `SESSION_SECRET` is already set. The code change (`env.SESSION_SECRET` replacing `process.env.SESSION_SECRET as string`) is safe once that audit confirms the value is present and consistent.

**Warning signs:** Users report being logged out after deployment. Check Railway/Vercel env var dashboard before shipping.

---

### Pitfall 3: Circular Import if encryption.ts Imports from session.ts or prisma.ts

**What goes wrong:** `src/lib/encryption.ts` imports `env` from `src/env.ts`. If someone later adds an import from `src/lib/prisma.ts` or `src/lib/session.ts` into `encryption.ts` (e.g., to log encryption events), and those files also import from `encryption.ts`, a circular dependency forms. Node.js handles circular imports by providing an empty object at the circular import point, causing subtle `is not a function` runtime errors.

**How to avoid:** Keep `src/lib/encryption.ts` as a pure utility — only `crypto` (built-in) and `env` imports. No Prisma, no session, no HTTP. The `env` import creates a dependency: `encryption.ts` → `env.ts`, which is fine because `env.ts` imports nothing from `src/lib/`.

---

### Pitfall 4: runtimeEnv Missing a Key Causes Silent Undefined

**What goes wrong:** `@t3-oss/env-nextjs` requires that every key declared in `server` or `client` appears in `runtimeEnv`. If a new env var is added to the `server` schema but forgotten in `runtimeEnv`, the validation sees `undefined` for that key and throws — even though the env var is set in the shell. The error message says the var is required but doesn't mention `runtimeEnv` missing it.

**How to avoid:** When adding a new var to the `server` or `client` block, always add it to `runtimeEnv` in the same edit. The `runtimeEnv` block and `server`/`client` blocks should always be in sync. A TypeScript error will surface this at compile time if `skipValidation` is not set.

---

### Pitfall 5: The Calendly Webhook Route Must Remove Its Conditional

**What goes wrong:** After env validation is added, `CALENDLY_WEBHOOK_SIGNING_KEY` is guaranteed to be set at startup. But if the developer forgets to update `src/app/api/webhooks/calendly/route.ts`, the old `if (webhookSigningKey)` conditional remains. The code still "works" but the test in success criterion 3 ("Starting the app without CALENDLY_WEBHOOK_SIGNING_KEY causes boot failure") will pass, while the webhook route will still have dead conditional logic that a future developer might re-enable.

**How to avoid:** As part of Phase 1, update the webhook route to remove the conditional guard and always call `verifyWebhookSignature(rawBody, signatureHeader, env.CALENDLY_WEBHOOK_SIGNING_KEY)`. This is not a functional change (the key is always present) but it makes the code's security guarantee explicit.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Existing session.ts — Before and After

```typescript
// BEFORE (src/lib/session.ts — current code)
const sessionOptions = {
  password: process.env.SESSION_SECRET as string,  // No validation; accepts undefined cast to string
  cookieName: "prical_session",
  // ...
}

// AFTER (Phase 1 change)
import { env } from '@/env'

const sessionOptions = {
  password: env.SESSION_SECRET,  // Typed string; guaranteed non-null by startup validation
  cookieName: "prical_session",
  // ...
}
```

### Existing stripe.ts — Before and After

```typescript
// BEFORE (src/lib/stripe.ts — current code)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {  // ! assertion; no validation
  // ...
})

export const STRIPE_PRICES = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    // ...
  }
}

// AFTER (Phase 1 change)
import { env } from '@/env'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {  // No assertion needed; already validated
  // ...
})

export const STRIPE_PRICES = {
  pro: {
    monthly: env.STRIPE_PRICE_PRO_MONTHLY,
    // ...
  }
}
```

### Webhook Route — Before and After (Security-Critical)

```typescript
// BEFORE (src/app/api/webhooks/calendly/route.ts — current code)
const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY  // May be undefined

if (webhookSigningKey) {  // SECURITY GAP: skips verification if key is missing
  if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSigningKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  // ...
}

// AFTER (Phase 1 change)
import { env } from '@/env'
// No conditional — env.CALENDLY_WEBHOOK_SIGNING_KEY is guaranteed non-null by startup validation
if (!verifyWebhookSignature(rawBody, signatureHeader, env.CALENDLY_WEBHOOK_SIGNING_KEY)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
if (!isTimestampValid(signatureHeader)) {
  return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 })
}
```

### Encryption Module — Key Generation Command

```bash
# Generate ENCRYPTION_KEY — run once, store permanently in environment
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output example: a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5e6a7b8c9d0e1f2
```

### Encryption Module — Basic Test Pattern

```typescript
// src/lib/encryption.test.ts (Phase 1 deliverable — tests for the primitive)
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './encryption'

describe('encryption', () => {
  it('roundtrips a plaintext string', () => {
    const plaintext = 'test-access-token-value'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext for same input (IV is random)', () => {
    const plaintext = 'same-input'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('throws on tampered ciphertext (GCM auth tag validation)', () => {
    const envelope = encrypt('sensitive')
    const tampered = envelope.slice(0, -4) + 'dead' // corrupt last 4 chars of ciphertext hex
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on invalid envelope format', () => {
    expect(() => decrypt('not-a-valid-envelope')).toThrow('Invalid encryption envelope format')
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.env.FOO!` TypeScript non-null assertion | `@t3-oss/env-nextjs` createEnv() with zod schema | T3 stack popularized ~2022-2023, stable since | Moves error from request-time crash to startup-time clear message |
| In-process env file loading | Next.js built-in env loading from `.env.local` | Next.js 9.4+ | No `dotenv` needed; Next.js handles it |
| AES-256-CBC (older cipher mode) | AES-256-GCM (authenticated encryption) | NIST standardized GCM; Node.js crypto stable | GCM adds authentication tag — decryption throws if ciphertext is tampered |
| Static IV for encryption | Random IV per encryption call via `crypto.randomBytes(12)` | Security community standard | Prevents keystream reuse attack that breaks GCM security |

**Deprecated/outdated:**
- `process.env.SESSION_SECRET as string`: TypeScript cast that silently accepts undefined; replaced by zod `z.string().min(32)` validation
- `if (webhookSigningKey)` conditional guard: removes security gate when key is missing; replaced by startup validation that makes the key unconditionally required

---

## Open Questions

1. **Should STRIPE_PRICE_* vars be required unconditionally?**
   - What we know: All four Stripe price vars are in `src/lib/stripe.ts` as `process.env.STRIPE_PRICE_*!`. They are required for the billing flow.
   - What's unclear: Are there test/CI environments that run without full Stripe configuration? Making them required would break any such environment.
   - Recommendation: Make them required in the zod schema (matches current `!` assertion intent). If CI needs to skip billing, use `.optional()` with a note, but default to required to match the security goal of this phase.

2. **Where should `src/env.ts` live — at project root `src/env.ts` or `src/lib/env.ts`?**
   - What we know: `@t3-oss/env-nextjs` documentation typically shows `src/env.ts`. The project's lib files are in `src/lib/`. Placing it at `src/env.ts` keeps it visually separate from lib utilities.
   - What's unclear: Does the team have a preference?
   - Recommendation: Use `src/env.ts` (not `src/lib/env.ts`) to match the T3 convention and avoid any import ambiguity with lib modules that will import from it.

3. **What is the minimum SESSION_SECRET length to enforce?**
   - What we know: The `.env.local` value is 57 characters. Iron-session accepts any string as a password. The existing zod schema draft in STACK.md uses `z.string().min(32)`. NIST recommends at least 128 bits (16 bytes) for symmetric keys.
   - Recommendation: Use `z.string().min(32)` — 32 characters is 256 bits if ASCII, satisfies NIST, and the existing dev secret already meets this bar. No user disruption.

---

## Sources

### Primary (HIGH confidence)

- `npm show @t3-oss/env-nextjs version` — confirmed version 0.13.10, latest as of 2026-02-20
- `npm show @t3-oss/env-nextjs peerDependencies` — confirmed `zod: "^3.24.0 || ^4.0.0"` (installed 3.25.76 satisfies)
- `/Users/stacysamuels/Desktop/Protectly/src/lib/session.ts` — direct code inspection; confirmed `process.env.SESSION_SECRET as string` on line 10 with no validation
- `/Users/stacysamuels/Desktop/Protectly/src/app/api/webhooks/calendly/route.ts` lines 60-76 — confirmed conditional `if (webhookSigningKey)` guard
- `/Users/stacysamuels/Desktop/Protectly/src/lib/stripe.ts` — confirmed 5 raw `process.env.*!` usages
- `/Users/stacysamuels/Desktop/Protectly/src/lib/calendly.ts` — confirmed 4 raw `process.env.CALENDLY_*` usages
- `/Users/stacysamuels/Desktop/Protectly/.env.local` — confirmed SESSION_SECRET is a real 57-char value (not undefined); confirmed ENCRYPTION_KEY is NOT present yet
- `/Users/stacysamuels/Desktop/Protectly/package.json` — confirmed `zod@^3.22.4` in dependencies; resolved to 3.25.76 (from node_modules check)
- Node.js `crypto` module — AES-256-GCM API; stable since Node.js 10; no version concerns

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — project-generated stack research confirming recommended approach and alternatives analysis
- `.planning/research/ARCHITECTURE.md` — project-generated architecture showing build order and data flow

### Tertiary (LOW confidence)

- None required for this phase — all findings verified directly from package registry or codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry and node_modules directly
- Architecture: HIGH — based on direct codebase inspection of all affected files
- Pitfalls: HIGH — derived from specific line numbers in current code, not hypothetical patterns

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — `@t3-oss/env-nextjs` is a stable library; Node.js crypto API is stable)

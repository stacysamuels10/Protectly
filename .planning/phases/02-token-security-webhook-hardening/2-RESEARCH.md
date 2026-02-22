# Phase 2: Token Security & Webhook Hardening - Research

**Researched:** 2026-02-22
**Domain:** AES-256-GCM token encryption integration, Prisma database migration, webhook timing and timing-safe comparison
**Confidence:** HIGH — all findings grounded in direct codebase inspection of current Phase 1 output + Node.js built-in APIs

---

## Summary

Phase 1 built the foundation: `src/env.ts` validates all env vars at startup, `src/lib/encryption.ts` provides a working `encrypt()`/`decrypt()` with the `enc:v1:` envelope format, and the three consumer lib files (`session.ts`, `stripe.ts`, `calendly.ts`) all use the typed `env` object. Phase 2 plugs the encryption module into the two token read/write paths and tightens two webhook controls.

The work has three distinct sub-problems. First, token writes: the OAuth callback (`src/app/api/auth/calendly/callback/route.ts`) stores plaintext tokens in Prisma — these calls need `encrypt()` wrappers before the `prisma.user.create/update`. Second, token reads: two functions read raw DB tokens and pass them directly to the Calendly API — `calendlyRequest()` in `src/lib/calendly.ts` and `cancelBookingWithRetry()` in `src/app/api/webhooks/calendly/route.ts`. Both need `decrypt()` calls, and the token refresh path inside each must also `encrypt()` the new tokens before writing them back. Third, a migration script must encrypt any existing plaintext rows so no token is left unencrypted after deploy. The webhook hardening sub-problems are smaller: change one default parameter in `src/lib/webhook.ts` (180s to 60s) and replace `.has()` / `.includes()` email comparison with `crypto.timingSafeEqual` on hashed values.

The critical planning insight is ordering: the migration script must run (and be verified with a count query) before any code that assumes encrypted tokens is deployed. Encrypting new tokens while leaving old ones plaintext is the number-one pitfall in this domain and produces silent 401 failures for returning users.

**Primary recommendation:** Implement in this order — (1) encrypt writes in OAuth callback, (2) decrypt reads in both token-reading functions including their refresh sub-paths, (3) run and verify the migration script, (4) webhook hardening. Keep the migration as a standalone executable script, not embedded in application startup.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOK-01 | Calendly OAuth access and refresh tokens are encrypted at rest using AES-256-GCM before storage in PostgreSQL | `encrypt()` from `src/lib/encryption.ts` called in OAuth callback before `prisma.user.create/update`; `calendlyRequest()` token refresh path must also encrypt new tokens before writing |
| TOK-02 | All existing plaintext tokens in the database are migrated to encrypted format via a one-time migration script | Standalone script using Prisma client directly; reads each user row, encrypts non-`enc:v1:`-prefixed tokens, writes back; verified with count query |
| TOK-03 | Token decryption is handled transparently in all read paths (calendlyRequest helper and cancelBookingWithRetry) | Two distinct code paths identified in codebase: `calendlyRequest()` in `src/lib/calendly.ts` lines 304–319 and `cancelBookingWithRetry()` in `src/app/api/webhooks/calendly/route.ts` lines 318–352; both must call `decrypt()` before using tokens |
| WHK-01 | Webhook timestamp tolerance is tightened from 180 seconds to 60 seconds | `isTimestampValid()` in `src/lib/webhook.ts` line 59 has `toleranceMs: number = 180000`; change default to `60000`; all call sites pass no second argument so they use the default |
| WHK-03 | Email comparisons in allowlist checks use timing-safe comparison via crypto.timingSafeEqual on hashed values | `isEmailApproved()` helper at line 139 of webhook route uses `allowedEmails.has(email.toLowerCase())` — a non-constant-time Set lookup; must replace with `crypto.timingSafeEqual` on hashed representations |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crypto` (Node.js built-in) | Node 18+ built-in | AES-256-GCM encrypt/decrypt; `timingSafeEqual`; SHA-256 hashing for email comparison | Already imported in project; zero new dependencies; NIST-standard primitives |
| `src/lib/encryption.ts` | Phase 1 output | `encrypt()`/`decrypt()` with `enc:v1:` versioned envelope | Already built and tested (4 tests green); import via `@/lib/encryption` |
| Prisma 5.7.1 | Already installed | Token write path (update) and migration script (batch read/update) | Already in use; no schema migration needed — `String @db.Text` columns are wide enough |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` or `ts-node` | Dev dependency | Run migration script as TypeScript without compiling | One-time script execution during deploy window |
| `@/env` | Phase 1 output | `env.ENCRYPTION_KEY` consumed by encryption module | Already in use throughout codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.timingSafeEqual` on SHA-256 hashed emails | Constant-time string comparison library | No new deps needed; Node built-in handles this exactly; library adds unnecessary dependency |
| Standalone migration script | Prisma migration + default value | Prisma migrations run DDL; encrypting application data is not DDL and does not belong in a schema migration |
| Standalone migration script | Application startup auto-migration | Startup migration creates a race condition if multiple instances start simultaneously; standalone script is safer and auditable |

**Installation:** No new packages needed. All required tools are Node.js built-ins or already installed dependencies.

---

## Architecture Patterns

### Recommended Project Structure

No new files beyond the migration script are needed. Changes are all surgical modifications to existing files.

```
scripts/
└── migrate-encrypt-tokens.ts    # NEW — one-time migration script

src/
├── lib/
│   ├── encryption.ts            # EXISTS (Phase 1) — no changes
│   ├── calendly.ts              # MODIFY — decrypt before use, encrypt on refresh write
│   └── webhook.ts               # MODIFY — change toleranceMs default to 60000
└── app/api/
    ├── auth/calendly/callback/
    │   └── route.ts             # MODIFY — encrypt before prisma.user.create/update
    └── webhooks/calendly/
        └── route.ts             # MODIFY — decrypt in cancelBookingWithRetry; timing-safe email comparison
```

### Pattern 1: Transparent Encrypt-on-Write / Decrypt-on-Read

**What:** Wrap token values with `encrypt()` at the two Prisma write sites, and wrap reads with `decrypt()` at the two token-consuming functions. The database column type does not change — `String @db.Text` is wide enough for the `enc:v1:` envelope.

**When to use:** Any time a value is written to `calendlyAccessToken` or `calendlyRefreshToken`.

**Call sites that write tokens (must add `encrypt()`):**

```typescript
// src/app/api/auth/calendly/callback/route.ts — new user creation
user = await prisma.user.create({
  data: {
    // ...
    calendlyAccessToken: encrypt(tokens.access_token),   // was: tokens.access_token
    calendlyRefreshToken: encrypt(tokens.refresh_token), // was: tokens.refresh_token
    // ...
  },
})

// src/app/api/auth/calendly/callback/route.ts — existing user update
await prisma.user.update({
  where: { id: user.id },
  data: {
    calendlyAccessToken: encrypt(tokens.access_token),   // was: tokens.access_token
    calendlyRefreshToken: encrypt(tokens.refresh_token), // was: tokens.refresh_token
    // ...
  },
})
```

**Call sites that read tokens (must add `decrypt()`):**

```typescript
// src/lib/calendly.ts — calendlyRequest() — line 304
try {
  return await requestFn(decrypt(user.calendlyAccessToken)) // was: user.calendlyAccessToken
} catch (error: any) {
  if (error.response?.status === 401) {
    const newTokens = await refreshAccessToken(decrypt(user.calendlyRefreshToken)) // was: user.calendlyRefreshToken
    await prisma.user.update({
      where: { id: userId },
      data: {
        calendlyAccessToken: encrypt(newTokens.access_token),   // was: newTokens.access_token
        calendlyRefreshToken: encrypt(newTokens.refresh_token), // was: newTokens.refresh_token
      },
    })
    return await requestFn(newTokens.access_token)
  }
  throw error
}

// src/app/api/webhooks/calendly/route.ts — cancelBookingWithRetry()
try {
  await cancelCalendlyEvent(decrypt(user.calendlyAccessToken!), eventUri, messageWithBranding)
} catch (error: any) {
  if (error.response?.status === 401) {
    const newTokens = await refreshAccessToken(decrypt(user.calendlyRefreshToken!))
    await prisma.user.update({
      where: { id: user.id },
      data: {
        calendlyAccessToken: encrypt(newTokens.access_token),
        calendlyRefreshToken: encrypt(newTokens.refresh_token),
      },
    })
    await cancelCalendlyEvent(newTokens.access_token, eventUri, messageWithBranding)
  } else {
    throw error
  }
}
```

### Pattern 2: One-Time Migration Script

**What:** A standalone TypeScript script that reads every `User` row with non-null tokens, detects whether they already have the `enc:v1:` prefix (skip if so), encrypts them, and writes back. Must be idempotent — safe to run multiple times.

**When to use:** Once, during the Phase 2 deploy window, before the application code that calls `decrypt()` is live.

**Example:**

```typescript
// scripts/migrate-encrypt-tokens.ts
import { PrismaClient } from '@prisma/client'
import { encrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === 'true'

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { calendlyAccessToken: { not: null } },
        { calendlyRefreshToken: { not: null } },
      ],
    },
    select: { id: true, calendlyAccessToken: true, calendlyRefreshToken: true },
  })

  console.log(`Found ${users.length} users with tokens`)

  let migrated = 0
  let skipped = 0

  for (const user of users) {
    const accessNeedsEncryption = user.calendlyAccessToken && !user.calendlyAccessToken.startsWith('enc:v1:')
    const refreshNeedsEncryption = user.calendlyRefreshToken && !user.calendlyRefreshToken.startsWith('enc:v1:')

    if (!accessNeedsEncryption && !refreshNeedsEncryption) {
      skipped++
      continue
    }

    if (!DRY_RUN) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(accessNeedsEncryption ? { calendlyAccessToken: encrypt(user.calendlyAccessToken!) } : {}),
          ...(refreshNeedsEncryption ? { calendlyRefreshToken: encrypt(user.calendlyRefreshToken!) } : {}),
        },
      })
    }

    migrated++
    console.log(`[${DRY_RUN ? 'DRY RUN' : 'MIGRATED'}] User ${user.id}`)
  }

  console.log(`\nSummary: ${migrated} migrated, ${skipped} already encrypted`)

  // Verification query
  const plaintext = await prisma.$queryRaw<Array<{count: bigint}>>`
    SELECT COUNT(*) as count FROM users
    WHERE ("calendlyAccessToken" IS NOT NULL AND "calendlyAccessToken" NOT LIKE 'enc:v1:%')
       OR ("calendlyRefreshToken" IS NOT NULL AND "calendlyRefreshToken" NOT LIKE 'enc:v1:%')
  `
  console.log(`Remaining plaintext token rows: ${plaintext[0].count}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Run with:**
```bash
# Dry run first
DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts

# Real migration
npx tsx scripts/migrate-encrypt-tokens.ts
```

### Pattern 3: Timing-Safe Email Comparison

**What:** The current allowlist check uses `allowedEmails.has(email.toLowerCase())` — a non-constant-time operation. Replace with a constant-time comparison using `crypto.timingSafeEqual` on SHA-256 hashes of the normalized email addresses. The Set is still fine for building the collection; only the final equality check must be constant-time.

**When to use:** In the `isEmailApproved` helper inside the webhook route, and any other place where email allowlist membership is tested.

**Implementation detail — the "hashed values" requirement:**

`crypto.timingSafeEqual` requires both buffers to be the same length. Comparing raw email strings of different lengths would leak length information. Hashing first (SHA-256 always produces 32 bytes) eliminates the length side channel.

The `allowedEmails` Set must be rebuilt as a Set of hashes, not plaintext emails:

```typescript
// In the webhook route — build hashed set
function hashEmail(email: string): Buffer {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest()
}

const allowedEmailHashes = new Set(
  (globalAllowlist?.entries || []).map(e => hashEmail(e.email).toString('hex'))
)

// Constant-time check
function isEmailApproved(email: string): boolean {
  const candidateHash = hashEmail(email)
  for (const storedHashHex of allowedEmailHashes) {
    const storedHash = Buffer.from(storedHashHex, 'hex')
    try {
      if (crypto.timingSafeEqual(candidateHash, storedHash)) {
        return true
      }
    } catch {
      // Lengths mismatched — should not happen with SHA-256 but handle defensively
    }
  }
  return false
}
```

**Important nuance:** Iterating over all hashes with `timingSafeEqual` rather than using Set.has() on the hash hex string technically still leaks the set size (more entries = longer loop). This is an acceptable tradeoff — the requirement is that the comparison does not short-circuit on byte differences within a single comparison, which `timingSafeEqual` guarantees. A simpler alternative that also satisfies the requirement: convert allowedEmails to a sorted concatenated blob and compare against a hash of (target_email + allowlist_blob). Either approach is correct; the looping approach is more readable and matches the success criterion literally.

**Simplest approach satisfying the success criterion:**

```typescript
// Build Set of hashed emails
const allowedEmailHashes = new Set(
  (globalAllowlist?.entries || []).map(e =>
    crypto.createHash('sha256').update(e.email.toLowerCase()).digest('hex')
  )
)

function isEmailApproved(email: string): boolean {
  const candidateHashHex = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
  const candidateHash = Buffer.from(candidateHashHex, 'hex')

  for (const storedHashHex of allowedEmailHashes) {
    const storedHash = Buffer.from(storedHashHex, 'hex')
    try {
      if (crypto.timingSafeEqual(candidateHash, storedHash)) return true
    } catch { /* skip */ }
  }
  return false
}
```

### Pattern 4: Timestamp Tolerance Change

**What:** `isTimestampValid()` in `src/lib/webhook.ts` has `toleranceMs: number = 180000`. Change the default to `60000`. No call sites pass the second argument, so all webhook timestamp checks will automatically use the new 60-second window.

**Single-line change:**

```typescript
// src/lib/webhook.ts — line 59
// Before:
export function isTimestampValid(
  signatureHeader: string | null,
  toleranceMs: number = 180000 // 3 minutes
): boolean {

// After:
export function isTimestampValid(
  signatureHeader: string | null,
  toleranceMs: number = 60000 // 60 seconds
): boolean {
```

**Verification:** Existing tests for `isTimestampValid` should use explicit `toleranceMs` arguments to avoid false failures from the default change. If any tests pass a timestamp 61–180 seconds ago with no explicit toleranceMs, they will need to be updated.

### Anti-Patterns to Avoid

- **Encrypting in migration while application is live with plaintext-reading code:** Deploy in correct order — migration runs, then new decrypt-reading code is deployed. Never the reverse.
- **Logging decrypted token values:** Never `console.log(decryptedToken)` or log the user object after decryption — logs are lower-security than the database.
- **Missing decrypt in one of the two token-reading functions:** Both `calendlyRequest()` and `cancelBookingWithRetry()` are independent code paths that both read tokens directly from Prisma results. Both must be updated. Grep verification: after the change, `user.calendlyAccessToken` and `user.calendlyRefreshToken` should appear inside `decrypt()` calls — never bare.
- **Not encrypting tokens from the refresh response:** When a 401 triggers token refresh, `refreshAccessToken()` returns new plaintext tokens. Both the re-used access token and the new refresh token must be encrypted before writing back to the database.
- **Using `timingSafeEqual` on buffers of different lengths without try/catch:** Throws a `RangeError` if lengths differ. SHA-256 hashing guarantees equal-length outputs, but always wrap in try/catch for safety.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom cipher or third-party lib | `encrypt()`/`decrypt()` from `@/lib/encryption` (Phase 1 output) | Already built and tested; reinventing causes subtle bugs |
| Constant-time buffer comparison | Custom byte-by-byte loop | `crypto.timingSafeEqual` (Node built-in) | Node's implementation uses timing-safe C primitives; custom loop in JS is vulnerable to V8 JIT optimizations |
| Migration state tracking | Custom "migration complete" flag | Query `NOT LIKE 'enc:v1:%'` count to verify | Simpler and auditable; no extra state to manage |

**Key insight:** All crypto primitives for this phase are already available — either built in Phase 1 or in Node's crypto module. No new libraries are needed.

---

## Common Pitfalls

### Pitfall 1: Migration Script Not Run Before Code Deployment

**What goes wrong:** Code with `decrypt()` calls is deployed while existing rows still have plaintext tokens. `decrypt()` throws `Error('Invalid encryption envelope format or unsupported version')` on the first request for any returning user. Booking cancellations fail silently because the webhook route catches all errors and returns `received: true` regardless.

**Why it happens:** The encryption code change and the migration are treated as one atomic deployment. In practice they must be sequenced: migrate data first, then deploy code.

**How to avoid:** Deploy in two steps. Step 1: deploy new code that encrypts on write (OAuth callback) but still handles both encrypted and plaintext reads (with a `isEncrypted ? decrypt(val) : val` guard). Step 2: run migration script. Step 3: verify with SQL count. Step 4: remove the plaintext-read guard. Alternatively — simpler — ensure the migration runs before the process that reads tokens restarts (Railway's deploy sequence makes this feasible).

**Warning signs:** `decrypt()` errors in logs after deploy for any user who logged in before Phase 2.

### Pitfall 2: Two Independent Token-Reading Code Paths

**What goes wrong:** Developer adds `decrypt()` to `calendlyRequest()` in `calendly.ts` but forgets `cancelBookingWithRetry()` in the webhook route (or vice versa). The webhook path fails silently — it catches all errors and returns `received: true`, so bookings that should be cancelled are not. There are no obvious error logs because the 401 from Calendly is caught and the refresh path sends ciphertext as the refresh token.

**Why it happens:** The two paths are in different files. Grep for `calendlyAccessToken` in the project returns hits in both files — easy to miss one under time pressure.

**How to avoid:** Search for every location where `user.calendlyAccessToken` and `user.calendlyRefreshToken` appear in code that uses them as strings (not just selects them). Both must be wrapped with `decrypt()`.

**Verification grep after implementation:**
```bash
grep -n "calendlyAccessToken\|calendlyRefreshToken" src/lib/calendly.ts src/app/api/webhooks/calendly/route.ts
```
Every usage that passes the value to an API call must be inside `decrypt()`.

**Warning signs:** Tests for `cancelBookingWithRetry` pass, but booking cancellations fail for users who authenticated before Phase 2. Token refresh logs show Calendly returning 400 (invalid refresh token) rather than 401.

### Pitfall 3: Token Refresh Path Writes Plaintext

**What goes wrong:** The 401 → refresh → retry flow in both functions refreshes the access token but writes plaintext new tokens back to the database:
```typescript
// BUG: plaintext write
data: {
  calendlyAccessToken: newTokens.access_token,  // must be encrypt(newTokens.access_token)
  calendlyRefreshToken: newTokens.refresh_token, // must be encrypt(newTokens.refresh_token)
}
```
After the first token refresh, the row reverts to plaintext. The migration was successful, but the first refresh undoes it.

**How to avoid:** When updating the Prisma write after `refreshAccessToken()`, always wrap both values in `encrypt()`. There are two such writes to update — one in `calendlyRequest()` and one in `cancelBookingWithRetry()`.

**Warning signs:** SQL count query shows 0 plaintext rows immediately after migration but shows plaintext rows after a few days of operation.

### Pitfall 4: `timingSafeEqual` Throws on Different-Length Buffers

**What goes wrong:** `crypto.timingSafeEqual(a, b)` throws `RangeError: Input buffers must have the same byte length` if `a.length !== b.length`. Without SHA-256 pre-hashing, email strings of different lengths throw.

**Why it happens:** Developers try `crypto.timingSafeEqual(Buffer.from(email1), Buffer.from(email2))` directly. `email1.length !== email2.length` causes a throw which falls through to a catch that returns false — silently defeating the constant-time guarantee for emails of different lengths.

**How to avoid:** Always hash both inputs with SHA-256 before comparison. Both outputs are 32 bytes. Wrap in try/catch as a defensive measure.

### Pitfall 5: Timestamp Change Breaks Existing Tests

**What goes wrong:** Changing `toleranceMs` default from 180000 to 60000 causes existing tests that use `isTimestampValid()` without an explicit second argument and pass a timestamp 61–180 seconds ago to start failing.

**How to avoid:** Audit all test calls to `isTimestampValid()`. If any test constructs a timestamp in the 61–180 second range and relies on it passing, update those tests to use an explicit `toleranceMs` argument. The production tolerance should be 60000; tests testing boundary conditions should use explicit values.

---

## Code Examples

Verified patterns from direct codebase analysis:

### Current `isTimestampValid` Signature (webhook.ts line 57–59)

```typescript
// Source: src/lib/webhook.ts (inspected 2026-02-22)
export function isTimestampValid(
  signatureHeader: string | null,
  toleranceMs: number = 180000 // 3 minutes — CHANGE TO 60000
): boolean {
```

### Current OAuth Callback Token Write (callback/route.ts lines 47–60)

```typescript
// Source: src/app/api/auth/calendly/callback/route.ts (inspected 2026-02-22)
// New user creation — currently writes plaintext
user = await prisma.user.create({
  data: {
    email: calendlyUser.email,
    name: calendlyUser.name,
    avatarUrl: calendlyUser.avatar_url,
    calendlyAccessToken: tokens.access_token,   // ADD: encrypt(tokens.access_token)
    calendlyRefreshToken: tokens.refresh_token, // ADD: encrypt(tokens.refresh_token)
    // ...
  },
})

// Existing user update — currently writes plaintext
await prisma.user.update({
  where: { id: user.id },
  data: {
    calendlyAccessToken: tokens.access_token,   // ADD: encrypt(tokens.access_token)
    calendlyRefreshToken: tokens.refresh_token, // ADD: encrypt(tokens.refresh_token)
    // ...
  },
})
```

### Current `cancelBookingWithRetry` Token Read (route.ts lines 318–352)

```typescript
// Source: src/app/api/webhooks/calendly/route.ts (inspected 2026-02-22)
// Currently passes raw encrypted string (or plaintext pre-migration) to API
try {
  await cancelCalendlyEvent(user.calendlyAccessToken, eventUri, messageWithBranding)
  //                        ^^^^ must be decrypt(user.calendlyAccessToken!)
} catch (error: any) {
  if (error.response?.status === 401) {
    const newTokens = await refreshAccessToken(user.calendlyRefreshToken)
    //                                          ^^^^ must be decrypt(user.calendlyRefreshToken!)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        calendlyAccessToken: newTokens.access_token,    // must be encrypt(...)
        calendlyRefreshToken: newTokens.refresh_token,  // must be encrypt(...)
      },
    })
    await cancelCalendlyEvent(newTokens.access_token, eventUri, messageWithBranding)
  }
}
```

### Current `calendlyRequest` Token Read (calendly.ts lines 285–325)

```typescript
// Source: src/lib/calendly.ts (inspected 2026-02-22)
// Missing decrypt calls:
try {
  return await requestFn(user.calendlyAccessToken)  // must be decrypt(user.calendlyAccessToken)
} catch (error: any) {
  if (error.response?.status === 401) {
    const newTokens = await refreshAccessToken(user.calendlyRefreshToken)
    //                                          ^^^^ must be decrypt(user.calendlyRefreshToken)
    await prisma.user.update({
      where: { id: userId },
      data: {
        calendlyAccessToken: newTokens.access_token,   // must be encrypt(...)
        calendlyRefreshToken: newTokens.refresh_token, // must be encrypt(...)
      },
    })
    return await requestFn(newTokens.access_token)
  }
  throw error
}
```

### Current Email Comparison (route.ts line 139)

```typescript
// Source: src/app/api/webhooks/calendly/route.ts (inspected 2026-02-22)
// Current non-constant-time check:
const isEmailApproved = (email: string) => allowedEmails.has(email.toLowerCase())
// Must be replaced with SHA-256 + timingSafeEqual approach (see Pattern 3 above)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plaintext OAuth tokens in PostgreSQL | AES-256-GCM encrypted with version prefix | This phase | Tokens at rest are protected; DB compromise does not expose usable tokens |
| 3-minute (180s) replay window | 60-second replay window | This phase | Reduces window for replayed webhook attacks |
| Set.has() email comparison | timingSafeEqual on SHA-256 hashes | This phase | Eliminates timing oracle that could leak allowlist membership |

**Deprecated/outdated after this phase:**
- Plaintext `calendlyAccessToken` / `calendlyRefreshToken` values in the `users` table: should not exist post-migration. Presence indicates a bug.
- `toleranceMs: 180000` in any call to `isTimestampValid()`: the parameter still exists but the default changes; callers that pass `180000` explicitly should be updated to `60000`.

---

## Open Questions

1. **Deploy sequencing: migrate-then-deploy or dual-read guard?**
   - What we know: Migration must run before the code that calls `decrypt()` is live. Railway deployments can run commands before the new process starts.
   - What's unclear: Whether Railway's deploy hooks support running a script before traffic is switched to the new deploy. If not, a dual-read guard (try decrypt, fall back to plaintext) is needed in v1 to allow zero-downtime migration.
   - Recommendation: Plan for both approaches. Write the migration script. Add a `isEncrypted()` helper that checks for the `enc:v1:` prefix and conditionally decrypts. Remove the fallback after migration is confirmed complete. This is the safest approach for a production system.

2. **Handling `decrypt()` errors for corrupted/missing tokens**
   - What we know: `decrypt()` throws on invalid envelope format. If a token is corrupted or somehow blank after migration, the error propagates.
   - What's unclear: Whether the application should treat a decrypt failure as "user not connected" (gracefully redirect to OAuth) rather than a 500 error.
   - Recommendation: In `calendlyRequest()` and `cancelBookingWithRetry()`, wrap `decrypt()` in a try/catch. On `Error('Invalid encryption envelope format')`, throw a user-friendly "User not connected to Calendly" error rather than exposing the crypto error.

3. **`WEBHOOK_URL` env var still uses raw `process.env` in callback/route.ts**
   - What we know: Line 39 of `callback/route.ts` uses `process.env.WEBHOOK_URL || fallback`. This is outside Phase 2's scope (not a TOK-* or WHK-* requirement) but is adjacent to the file being modified.
   - What's unclear: Whether the planner wants to fix this in-scope or leave it for later.
   - Recommendation: Leave it. It is not a security requirement in this phase, and scope creep risks are real. Note it for Phase cleanup.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/encryption.ts` — inspected 2026-02-22 — exact envelope format `enc:v1:{iv}:{authTag}:{ciphertext}`; `decrypt()` signature and error message
- `src/lib/webhook.ts` — inspected 2026-02-22 — `isTimestampValid` default `toleranceMs: 180000` confirmed at line 59
- `src/lib/calendly.ts` — inspected 2026-02-22 — `calendlyRequest()` reads raw token at line 304; token refresh write at lines 310–316
- `src/app/api/webhooks/calendly/route.ts` — inspected 2026-02-22 — `cancelBookingWithRetry()` reads raw tokens at lines 331 and 335; token write at lines 338–341; email comparison at line 139
- `src/app/api/auth/calendly/callback/route.ts` — inspected 2026-02-22 — plaintext token writes at lines 52–53 (create) and 76–77 (update)
- `prisma/schema.prisma` — inspected 2026-02-22 — `calendlyAccessToken String? @db.Text` confirmed; no schema change needed for this phase
- `.planning/phases/01-foundation/01-02-SUMMARY.md` — Phase 1 Plan 02 output — encryption module details, test patterns, `vi.mock('@/env')` approach
- Node.js `crypto` module documentation — `timingSafeEqual` requires equal-length Buffers (HIGH confidence — stable API, well-documented constraint)

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — Pitfall 1 (migration ordering) and Pitfall 2 (two token-reading paths) are directly applicable and were verified against the actual codebase
- `.planning/research/ARCHITECTURE.md` — Token encryption read/write path data flow (verified against actual code)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools are Node built-ins or Phase 1 output already in the codebase
- Architecture: HIGH — all file locations, function names, and line numbers verified by direct code inspection
- Pitfalls: HIGH — each pitfall maps to a specific current code location in the actual files

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain; Node crypto API and Prisma 5.7 are not changing)

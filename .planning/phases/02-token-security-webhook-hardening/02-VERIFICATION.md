---
phase: 02-token-security-webhook-hardening
verified: 2026-02-22T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 2: Token Security and Webhook Hardening Verification Report

**Phase Goal:** All Calendly OAuth tokens are encrypted at rest, all existing plaintext rows are migrated, and the webhook handler enforces tighter replay and timing-safe comparison rules
**Verified:** 2026-02-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OAuth callback encrypts both tokens in both write paths (create + update) | VERIFIED | Lines 53-54 (create) and 78-79 (update) in `callback/route.ts` both call `encrypt(tokens.access_token)` and `encrypt(tokens.refresh_token)` |
| 2 | Webhook timestamp tolerance is 60 seconds (not 180 seconds) | VERIFIED | `webhook.ts` line 59: `toleranceMs: number = 60000 // 60 seconds`; grep for 180000 returns no matches |
| 3 | Email allowlist comparisons use `crypto.timingSafeEqual` on SHA-256 hashed values — no `Set.has()` on raw email | VERIFIED | Lines 136-155 of `route.ts`: `allowedEmailHashes` Set of SHA-256 hex digests, `isEmailApproved()` uses `crypto.timingSafeEqual`; grep for `allowedEmails.has` returns no matches |
| 4 | `calendlyRequest()` decrypts tokens before API call; encrypts new tokens on 401 refresh | VERIFIED | `calendly.ts` lines 308-309: `decrypt(user.calendlyAccessToken)`, `decrypt(user.calendlyRefreshToken)`; lines 325-326: `encrypt(newTokens.access_token)`, `encrypt(newTokens.refresh_token)` |
| 5 | `cancelBookingWithRetry()` decrypts tokens before cancel call; encrypts new tokens on 401 refresh | VERIFIED | `route.ts` lines 347-348: `decrypt(user.calendlyAccessToken)`, `decrypt(user.calendlyRefreshToken!)`; lines 367-368: `encrypt(newTokens.access_token)`, `encrypt(newTokens.refresh_token)` |
| 6 | No bare token value reaches any API call (all usages inside `decrypt()`) | VERIFIED | All `user.calendlyAccessToken`/`user.calendlyRefreshToken` accesses in both files are either null guards or wrapped in `decrypt()` |
| 7 | Migration script exists, is substantive (123 lines), and is idempotent via `enc:v1:` prefix check | VERIFIED | `scripts/migrate-encrypt-tokens.ts`: 123 lines, 6 occurrences of `enc:v1:`, 6 occurrences of `DRY_RUN`, 4 occurrences of `process.exit(1)` |
| 8 | Migration script produces the same `enc:v1:` envelope format as `encryption.ts` | VERIFIED | Both produce `enc:v1:${iv.hex}:${authTag.hex}:${ciphertext.hex}` — exact string match at `encryption.ts` line 15 and `migrate-encrypt-tokens.ts` line 47 |
| 9 | Tests exist for decrypt-on-read happy path and encrypt-on-refresh for both functions | VERIFIED | `calendly.test.ts` (168 lines, 3 tests); `route.test.ts` (291 lines, 2 tests via POST integration path) — 5 tests total |
| 10 | Corrupted-envelope guard propagates user-friendly error | VERIFIED | Both `calendlyRequest()` and `cancelBookingWithRetry()` have `try/catch` around `decrypt()` converting crypto errors to `Error('User not connected to Calendly')`; test in `calendly.test.ts` covers this case |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/auth/calendly/callback/route.ts` | `encrypt()` wrapping both token writes (create and update paths) | VERIFIED | Lines 53-54 (create), 78-79 (update); import at line 9 |
| `src/lib/webhook.ts` | `isTimestampValid()` with 60-second default tolerance | VERIFIED | Line 59: `60000`; no occurrence of `180000` |
| `src/app/api/webhooks/calendly/route.ts` | Timing-safe email comparison via `crypto.timingSafeEqual` on SHA-256 hashes | VERIFIED | Lines 136-155; `timingSafeEqual` at line 149; SHA-256 hash at lines 138, 144 |
| `src/lib/calendly.ts` | `calendlyRequest()` with `decrypt()` on both token reads and `encrypt()` on both refresh writes | VERIFIED | Lines 308-309 (decrypt), 325-326 (encrypt); import at line 3 |
| `src/app/api/webhooks/calendly/route.ts` | `cancelBookingWithRetry()` with `decrypt()` on both token reads and `encrypt()` on both refresh writes | VERIFIED | Lines 347-348 (decrypt), 367-368 (encrypt); import at line 7 |
| `src/lib/calendly.test.ts` | Tests for `calendlyRequest()` token decrypt + encrypt-on-refresh (min 30 lines) | VERIFIED | 168 lines; 3 tests: happy path, 401 refresh path, corrupted envelope |
| `src/app/api/webhooks/calendly/route.test.ts` | Tests for `cancelBookingWithRetry()` token decrypt + encrypt-on-refresh (min 30 lines) | VERIFIED | 291 lines; 2 tests via POST handler integration path |
| `scripts/migrate-encrypt-tokens.ts` | Idempotent migration script, min 50 lines, contains `DRY_RUN` | VERIFIED | 123 lines; `DRY_RUN` appears 6 times; `enc:v1:` prefix idempotency check at lines 73, 75 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/auth/calendly/callback/route.ts` | `src/lib/encryption.ts` | `import { encrypt } from '@/lib/encryption'` | WIRED | Line 9: `import { encrypt } from "@/lib/encryption"` |
| `src/app/api/webhooks/calendly/route.ts` | `node:crypto` | `import crypto from 'node:crypto'` for `timingSafeEqual` | WIRED | Line 2: `import crypto from 'node:crypto'`; `timingSafeEqual` at line 149 |
| `src/lib/webhook.ts` | callers | default parameter change — callers without explicit `toleranceMs` now use 60s | WIRED | Line 59: default is `60000`; webhook route calls `isTimestampValid(signatureHeader)` with no second argument at line 72 of `route.ts` |
| `src/lib/calendly.ts` | `src/lib/encryption.ts` | `import { encrypt, decrypt } from '@/lib/encryption'` | WIRED | Line 3: exact match |
| `src/app/api/webhooks/calendly/route.ts` | `src/lib/encryption.ts` | `import { encrypt, decrypt } from '@/lib/encryption'` | WIRED | Line 7: exact match |
| `src/lib/calendly.ts` | `prisma.user.update` | `encrypt(newTokens.access_token)` and `encrypt(newTokens.refresh_token)` in 401 refresh path | WIRED | Lines 325-326: confirmed `encrypt(newTokens.access_token)` and `encrypt(newTokens.refresh_token)` |
| `scripts/migrate-encrypt-tokens.ts` | `enc:v1:` format | Inlined encrypt() producing identical envelope format | WIRED | Line 47 produces `enc:v1:${iv.hex}:${authTag.hex}:${ciphertext.hex}` — matches `encryption.ts` line 15 exactly. Note: PLAN specified `import { encrypt } from '../src/lib/encryption'` but implementation intentionally inlines encrypt() to avoid `@/env` validation requiring all 13 env vars. The inlined function produces identical output — documented deviation in SUMMARY. |
| `scripts/migrate-encrypt-tokens.ts` | `prisma` (users table) | `PrismaClient findMany + update` for rows without `enc:v1:` prefix | WIRED | Lines 56-64 (findMany), lines 83-94 (update), prefix check at lines 73-75 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOK-01 | 02-01 | Calendly OAuth access and refresh tokens encrypted at rest using AES-256-GCM before storage | SATISFIED | `callback/route.ts` lines 53-54 and 78-79: `encrypt()` wraps all 4 token assignments; import at line 9 |
| TOK-02 | 02-03 | All existing plaintext tokens migrated to encrypted format via one-time migration script | SATISFIED | `scripts/migrate-encrypt-tokens.ts` exists (123 lines), DRY_RUN mode, idempotency via prefix check, SQL COUNT verification, exits non-zero if plaintext rows remain. Note: per Plan 03 user_setup, production migration requires human to run `railway run npx tsx scripts/migrate-encrypt-tokens.ts` — script is ready but production execution is user-gated |
| TOK-03 | 02-02 | Token decryption handled transparently in all read paths | SATISFIED | `calendly.ts` lines 308-309 and `route.ts` lines 347-348: all token reads inside `decrypt()`; 5 tests cover decrypt-on-read and encrypt-on-refresh |
| WHK-01 | 02-01 | Webhook timestamp tolerance tightened from 180 seconds to 60 seconds | SATISFIED | `webhook.ts` line 59: `toleranceMs: number = 60000`; 180000 absent from file |
| WHK-03 | 02-01 | Email comparisons in allowlist checks use timing-safe comparison via `crypto.timingSafeEqual` on hashed values | SATISFIED | `route.ts` lines 136-155: SHA-256 hash Set, `timingSafeEqual` comparison, old `Set.has()` absent |

**Orphaned requirements check:** WHK-02 (duplicate webhook idempotency) is mapped to Phase 4 in REQUIREMENTS.md — not a Phase 2 concern and correctly absent from all Phase 2 plans.

---

### Anti-Patterns Found

No anti-patterns detected across all Phase 2 modified files:

- No TODO/FIXME/XXX/HACK/PLACEHOLDER comments
- No empty implementations (`return null`, `return {}`, `return []`)
- No stub handlers
- No console.log-only implementations

---

### Notable Deviations (Non-Blocking)

**Migration script self-contained encrypt():** Plan 02-03 specified `import { encrypt } from '../src/lib/encryption'`. The implementation instead inlines an equivalent `encrypt()` function directly in the script. This was an intentional, documented deviation: `encryption.ts` transitively imports `@/env`, which validates all 13 env vars at module load — making it unusable in a standalone script that only has `DATABASE_URL` and `ENCRYPTION_KEY`. The inlined function produces an identical `enc:v1:` envelope format (verified by comparing line 47 of `migrate-encrypt-tokens.ts` with line 15 of `encryption.ts`). This is architecturally correct and was smoke-tested against a real database row.

---

### Human Verification Required

**1. Production database migration**

**Test:** Run `railway run DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts`, confirm output, then run without `DRY_RUN` and verify "Remaining plaintext token rows: 0"
**Expected:** Script exits 0; dry-run shows planned row count; real run reports 0 plaintext rows remaining
**Why human:** Requires access to the Railway production database. Local smoke test confirmed the script works correctly (1 row migrated, idempotency on second run), but the production migration is a manual deploy step documented in Plan 03 user_setup frontmatter.

---

### Gaps Summary

No gaps. All 10 observable truths verified. All 8 required artifacts exist, are substantive, and are wired. All 5 requirement IDs (TOK-01, TOK-02, TOK-03, WHK-01, WHK-03) are satisfied with implementation evidence. Six commits verified in git history (3fd69fc, 0c061ca, 49aa11c, a2273c3, 6abf8b1, e2c0456).

The only pending item is the production database migration (TOK-02), which is user-gated by design — the script exists and is ready, and the requirement is considered satisfied at the code level. Production execution is documented in the Plan 03 user_setup frontmatter and deploy sequencing guide.

---

_Verified: 2026-02-22_
_Verifier: Claude (gsd-verifier)_

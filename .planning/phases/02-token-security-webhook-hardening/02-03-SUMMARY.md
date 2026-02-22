---
phase: 02-token-security-webhook-hardening
plan: 03
subsystem: database
tags: [migration, encryption, aes-256-gcm, prisma, calendly, oauth, idempotent]

# Dependency graph
requires:
  - phase: 02-token-security-webhook-hardening
    plan: 01
    provides: AES-256-GCM encrypt/decrypt primitives; enc:v1: envelope format
  - phase: 02-token-security-webhook-hardening
    plan: 02
    provides: decrypt-on-read path in calendlyRequest and cancelBookingWithRetry

provides:
  - One-time idempotent migration script encrypting plaintext Calendly tokens in users table
  - DRY_RUN=true mode for safe preview of migration without DB writes
  - SQL COUNT verification asserting 0 plaintext rows remain after real run
  - Recommended production deploy sequence: migrate first, then deploy Phase 2 app code

affects: [production-deploy, 03-rate-limiting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-contained migration script: reads ENCRYPTION_KEY/DATABASE_URL from process.env directly — no @/env import — avoids pulling in full app env validation for standalone scripts"
    - "Idempotency via enc:v1: prefix check: skip rows already encrypted before writing; safe to run twice"
    - "SQL COUNT safety gate: exits non-zero if plaintext rows remain after real migration run"

key-files:
  created:
    - scripts/migrate-encrypt-tokens.ts
  modified: []

key-decisions:
  - "Script is self-contained: inlines encrypt() from Node.js crypto directly rather than importing encryption.ts, which pulls in @/env and requires all 13 env vars — migration only needs DATABASE_URL and ENCRYPTION_KEY"
  - "Recommended deploy order: migrate production DB first (before deploying Plans 01+02 app code) — avoids any window where decrypt() is called on plaintext rows"
  - "BigInt literal 0n replaced with BigInt(0) for ES2017 tsconfig target compatibility"

patterns-established:
  - "Standalone scripts must not import from @/env or any module that transitively imports it — read required env vars directly from process.env with explicit null checks"

requirements-completed: [TOK-02]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 2 Plan 03: Token Migration Script Summary

**Self-contained idempotent migration script encrypts all plaintext Calendly OAuth tokens in the users table via AES-256-GCM; DRY_RUN=true verified against local DB with 1 real row migrated and 0 plaintext rows remaining — closes TOK-02**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T16:08:48Z
- **Completed:** 2026-02-22T16:11:06Z
- **Tasks:** 1 (auto task complete; checkpoint pending human verification)
- **Files created:** 1

## Accomplishments

- `scripts/migrate-encrypt-tokens.ts` created as a self-contained, idempotent migration script
- Script reads `ENCRYPTION_KEY` and `DATABASE_URL` directly from `process.env` — bypasses `@/env` app validator which requires all 13 env vars
- Idempotency: skips rows already prefixed with `enc:v1:` — safe to run twice with no double-encryption
- `DRY_RUN=true` mode prints planned changes without modifying any rows; exits 0
- SQL `COUNT` verification after real run; exits non-zero if any plaintext rows remain (safety gate)
- Smoke tested against local dev database: 1 user had plaintext tokens → migrated → 0 plaintext rows remaining → second dry-run confirmed 1 skipped (already encrypted)
- Full vitest suite 47/47 pass; TypeScript compiles cleanly (no errors in modified files)

## Phase 2 Requirements Summary

All 5 Phase 2 requirements are now addressed:
- **TOK-01** (Plan 01): Calendly OAuth tokens encrypted at write path in callback route
- **TOK-02** (Plan 03, this plan): Migration script for existing plaintext rows in users table
- **TOK-03** (Plan 02): decrypt-on-read and encrypt-on-refresh in calendlyRequest + cancelBookingWithRetry
- **WHK-01** (Plan 01): Webhook timestamp replay window reduced to 60 seconds
- **WHK-03** (Plan 01): Email allowlist comparison uses SHA-256 + crypto.timingSafeEqual

## Production Deploy Sequence (RECOMMENDED ORDER)

**Migrate first, then deploy application code.** This is the safest ordering:

1. **Run dry-run against production DB:**
   ```
   railway run DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts
   ```
   - Confirm "Found N users with tokens" looks correct
   - Confirm "Remaining plaintext token rows: N" is the expected count

2. **Run real migration against production DB:**
   ```
   railway run npx tsx scripts/migrate-encrypt-tokens.ts
   ```
   - Verify output: `Remaining plaintext token rows: 0`
   - Script exits non-zero if any plaintext rows remain (stops deploy)

3. **Deploy Phase 2 application code (Plans 01 + 02):**
   - After migration, all rows are `enc:v1:` prefixed
   - decrypt() in calendlyRequest/cancelBookingWithRetry will work immediately
   - No transition window where decrypt() is called on plaintext rows

**Why this order is safer:** If Plans 01+02 code is deployed first, a window exists where `decrypt()` is called on plaintext rows (which will throw an InvalidEnvelopeFormat error). Running migration first eliminates that window entirely.

## Task Commits

1. **Task 1: Create and smoke-test the token migration script** - `e2c0456` (feat)

## Files Created

- `scripts/migrate-encrypt-tokens.ts` — Self-contained migration script: inlines AES-256-GCM encrypt(), reads env directly, DRY_RUN mode, SQL COUNT verification, idempotency via enc:v1: prefix check

## Decisions Made

- Script is self-contained (inlines encrypt() rather than importing from `@/lib/encryption`) because `encryption.ts` transitively imports `@/env`, which validates all 13 env vars — a standalone migration script should only need `DATABASE_URL` and `ENCRYPTION_KEY`
- Production deploy order: migrate-first avoids any decrypt-on-plaintext window
- `BigInt(0)` used instead of `0n` literal for ES2017 tsconfig compatibility (BigInt literals require ES2020 target)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made script self-contained to avoid @/env full env validation**
- **Found during:** Task 1 (smoke test attempt)
- **Issue:** Plan specified `import { encrypt } from '../src/lib/encryption'` — but `encryption.ts` imports `@/env`, which validates all 13 env vars at module load. Running `DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts` failed with "Invalid environment variables" because `.env.local` only has app-specific keys, not Stripe price IDs etc.
- **Fix:** Replaced the import with an inlined encrypt() function using Node.js `crypto` directly; added explicit `process.env` checks for `ENCRYPTION_KEY` and `DATABASE_URL` with clear error messages. The inlined function produces identical `enc:v1:` envelope format — verified by running migration on a real row.
- **Files modified:** scripts/migrate-encrypt-tokens.ts
- **Verification:** DRY_RUN=true exits 0; real migration reports 0 plaintext rows; TypeScript compiles cleanly
- **Committed in:** `e2c0456` (Task 1 commit)

**2. [Rule 1 - Bug] Replaced BigInt literal 0n with BigInt(0) for tsconfig ES2017 target**
- **Found during:** Task 1 verification (`npx tsc --noEmit --skipLibCheck | grep migrate`)
- **Issue:** `if (!DRY_RUN && plaintext[0].count > 0n)` — BigInt literals (`0n`) are not available when targeting ES2017; tsconfig.json uses `"target": "ES2017"`
- **Fix:** Replaced `0n` with `BigInt(0)` (constructor call compatible with ES2017)
- **Files modified:** scripts/migrate-encrypt-tokens.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck 2>&1 | grep migrate` returns no output (no errors)
- **Committed in:** `e2c0456` (Task 1 commit, same commit as fix 1)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug)
**Impact on plan:** Both fixes were necessary for the script to function correctly. The self-contained approach is architecturally better for a standalone migration script anyway. No scope creep.

## Local Smoke Test Results

```
$ DRY_RUN=true npx tsx --env-file .env.local scripts/migrate-encrypt-tokens.ts
Starting token migration (DRY_RUN=true)
Found 1 users with tokens
[DRY RUN] User 02a02157-0b33-4833-acb7-08783f9ce5de

Summary: 1 migrated, 0 already encrypted
Remaining plaintext token rows: 1

$ npx tsx --env-file .env.local scripts/migrate-encrypt-tokens.ts
Starting token migration (DRY_RUN=false)
Found 1 users with tokens
[MIGRATED] User 02a02157-0b33-4833-acb7-08783f9ce5de

Summary: 1 migrated, 0 already encrypted
Remaining plaintext token rows: 0

$ DRY_RUN=true npx tsx --env-file .env.local scripts/migrate-encrypt-tokens.ts
Starting token migration (DRY_RUN=true)
Found 1 users with tokens

Summary: 0 migrated, 1 already encrypted
Remaining plaintext token rows: 0
```

Idempotency confirmed: second run skips already-encrypted row.

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required (Production)

Before deploying Phase 2 application code:

1. Set `ENCRYPTION_KEY` in Railway dashboard (must be set from Phase 1)
2. Run dry-run: `railway run DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts`
3. Run real migration: `railway run npx tsx scripts/migrate-encrypt-tokens.ts`
4. Verify "Remaining plaintext token rows: 0" in output
5. Deploy Phase 2 application code

## Next Phase Readiness

- All 5 Phase 2 requirements (TOK-01, TOK-02, TOK-03, WHK-01, WHK-03) are addressed
- Phase 3 (Rate Limiting) can proceed after human verification at checkpoint
- Blockers from STATE.md to carry forward:
  - Phase 3: Verify @upstash/ratelimit ~2.x Edge runtime compatibility with Next.js 15.1.3
  - Phase 3: Confirm Upstash free tier limits vs. expected traffic

---
*Phase: 02-token-security-webhook-hardening*
*Completed: 2026-02-22*

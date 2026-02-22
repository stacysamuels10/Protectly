---
phase: 02-token-security-webhook-hardening
plan: 01
subsystem: auth
tags: [encryption, aes-256-gcm, webhook, sha256, timing-safe, calendly, oauth]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AES-256-GCM encrypt() primitive in src/lib/encryption.ts

provides:
  - Calendly OAuth tokens encrypted at write path (create + update) using enc:v1: envelope
  - Webhook timestamp replay window reduced to 60 seconds
  - Email allowlist comparison using crypto.timingSafeEqual on SHA-256 hashes

affects: [03-token-migration, all phases using calendlyAccessToken or allowlist comparison]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Encrypt at write path: always call encrypt() before any Prisma token write, never store plaintext"
    - "Timing-safe comparison: SHA-256 hash all comparison inputs, use crypto.timingSafeEqual for constant-time equality"
    - "Strict replay window: webhook tolerance defaults to 60s to limit replay attack surface"

key-files:
  created: []
  modified:
    - src/app/api/auth/calendly/callback/route.ts
    - src/lib/webhook.ts
    - src/app/api/webhooks/calendly/route.ts

key-decisions:
  - "No plaintext-read guard added at write path — migration script (Plan 03) will handle existing plaintext rows; write path always encrypts"
  - "isEmailApproved converted from arrow const to named function declaration to support hoisting if needed"
  - "allowedEmailHashes Set replaces allowedEmails Set — logging reference updated to allowedEmailHashes.size"

patterns-established:
  - "Encrypt at write: every Prisma token assignment wraps with encrypt() — both create and update paths"
  - "Timing-safe allowlist: SHA-256 hash the candidate email and iterate allowedEmailHashes with timingSafeEqual"

requirements-completed: [TOK-01, WHK-01, WHK-03]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 2 Plan 01: Token Encryption and Webhook Hardening Summary

**AES-256-GCM token encryption at OAuth write path, 60s replay window, and SHA-256 timing-safe email allowlist comparison — all three security gaps closed in surgical 3-file edits**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T10:58:51Z
- **Completed:** 2026-02-22T11:02:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Calendly OAuth callback now calls `encrypt()` on both `calendlyAccessToken` and `calendlyRefreshToken` in both the `prisma.user.create` (new user) and `prisma.user.update` (existing user) paths — closes TOK-01
- `isTimestampValid()` default tolerance reduced from 180000ms (3 minutes) to 60000ms (60 seconds) — closes WHK-01; no test updates required as no tests relied on the 61–180s range
- `isEmailApproved()` in the webhook route replaced: `allowedEmails` Set (plaintext) replaced with `allowedEmailHashes` Set (SHA-256 hex), and comparison replaced with `crypto.timingSafeEqual` on 32-byte buffers — closes WHK-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Encrypt token writes in OAuth callback route** - `3fd69fc` (feat)
2. **Task 2: Tighten webhook timestamp tolerance to 60 seconds** - `0c061ca` (fix)
3. **Task 3: Replace non-constant-time email comparison with timing-safe SHA-256 check** - `49aa11c` (fix)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `src/app/api/auth/calendly/callback/route.ts` - Added `import { encrypt } from '@/lib/encryption'`; wrapped all 4 token assignments with `encrypt()`
- `src/lib/webhook.ts` - Changed `isTimestampValid()` default `toleranceMs` from `180000` to `60000`; updated comment
- `src/app/api/webhooks/calendly/route.ts` - Added `import crypto from 'node:crypto'`; replaced `allowedEmails` Set with `allowedEmailHashes` Set of SHA-256 digests; replaced `isEmailApproved` arrow function with named function using `crypto.timingSafeEqual`; updated `allowedEmails.size` log reference to `allowedEmailHashes.size`

## Decisions Made
- No plaintext-read guard added at write path: Plan 03 (migration script) will handle existing plaintext rows; the write path must always encrypt regardless
- `isEmailApproved` converted from `const` arrow function to named `function` declaration per plan specification
- Pre-existing TypeScript errors in `.next/types/cache-life.d 2.ts` (Next.js auto-generated duplicate file) are out of scope — not in modified files, not introduced by this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated allowedEmails.size log reference after Set rename**
- **Found during:** Task 3 (timing-safe email comparison implementation)
- **Issue:** Renamed `allowedEmails` to `allowedEmailHashes` but log on line 222 still referenced `allowedEmails.size`, which would cause a runtime ReferenceError
- **Fix:** Updated log reference to `allowedEmailHashes.size`
- **Files modified:** src/app/api/webhooks/calendly/route.ts
- **Verification:** TypeScript compilation clean (no errors in modified files); vitest 42/42 pass
- **Committed in:** `49aa11c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug during rename)
**Impact on plan:** Necessary correctness fix caught during Task 3 implementation. No scope creep.

## Issues Encountered
None beyond the allowedEmails rename reference fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TOK-01, WHK-01, WHK-03 all closed
- Plan 02 (token read-path: decrypt() wrapper + isEncrypted guard for decryption callers) can now proceed
- Plan 03 (migration script for existing plaintext rows) depends on both Plans 01 and 02

## Self-Check: PASSED

- FOUND: src/app/api/auth/calendly/callback/route.ts
- FOUND: src/lib/webhook.ts
- FOUND: src/app/api/webhooks/calendly/route.ts
- FOUND: .planning/phases/02-token-security-webhook-hardening/02-01-SUMMARY.md
- FOUND commit 3fd69fc (feat: encrypt tokens at write path)
- FOUND commit 0c061ca (fix: tighten timestamp tolerance)
- FOUND commit 49aa11c (fix: timing-safe email comparison)
- All 42 vitest tests pass

---
*Phase: 02-token-security-webhook-hardening*
*Completed: 2026-02-22*

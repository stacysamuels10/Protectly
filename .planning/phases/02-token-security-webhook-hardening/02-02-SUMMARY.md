---
phase: 02-token-security-webhook-hardening
plan: 02
subsystem: auth
tags: [encryption, aes-256-gcm, decrypt-on-read, encrypt-on-refresh, calendly, oauth, tdd]

# Dependency graph
requires:
  - phase: 02-token-security-webhook-hardening
    plan: 01
    provides: AES-256-GCM encrypt/decrypt primitives; tokens encrypted at write path

provides:
  - calendlyRequest() decrypts tokens before API call; encrypts new tokens after 401 refresh
  - cancelBookingWithRetry() decrypts tokens before cancelCalendlyEvent; encrypts new tokens after 401 refresh
  - Corrupted envelope handling with user-friendly error in both functions

affects: [03-token-migration, all read paths consuming calendlyAccessToken/calendlyRefreshToken]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decrypt on read: always call decrypt() on enc:v1: tokens before passing to API — no bare ciphertext envelope reaches HTTP"
    - "Encrypt on refresh: always call encrypt() on refreshed tokens before Prisma update — refresh path does not revert rows to plaintext"
    - "Corrupted-envelope guard: wrap decrypt() in try/catch converting crypto errors to user-friendly Error('User not connected to Calendly')"

key-files:
  created:
    - src/lib/calendly.test.ts
    - src/app/api/webhooks/calendly/route.test.ts
  modified:
    - src/lib/calendly.ts
    - src/app/api/webhooks/calendly/route.ts

key-decisions:
  - "Refactor phase skipped: decrypt try/catch pattern is two lines in each file — no meaningful duplication to extract"
  - "cancelBookingWithRetry() tested via POST handler integration path (function is not exported) — vi.useFakeTimers() bypasses the 4-second delay"
  - "Mock strategy: vi.mock('@/lib/encryption') controls encrypt/decrypt behavior; vi.mock('@/lib/calendly') intercepts refreshAccessToken for route tests; axios.post spy used for calendlyRequest refresh path"

patterns-established:
  - "vi.mock('@/lib/encryption') with deterministic enc:v1:mocked: prefix enables verifying exact encrypt/decrypt call sites"
  - "vi.useFakeTimers() + vi.runAllTimersAsync() to bypass setTimeout delays in webhook route during tests"

requirements-completed: [TOK-03]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 2 Plan 02: Token Decrypt-on-Read and Encrypt-on-Refresh Summary

**AES-256-GCM decrypt-on-read added to both Calendly token paths (calendlyRequest and cancelBookingWithRetry) via TDD; 401 refresh sub-paths also encrypt before DB write — closes TOK-03**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T16:03:35Z
- **Completed:** 2026-02-22T16:06:13Z
- **Tasks:** 2 (RED + GREEN; REFACTOR skipped)
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- `calendlyRequest()` in `src/lib/calendly.ts` now calls `decrypt(user.calendlyAccessToken)` and `decrypt(user.calendlyRefreshToken)` before any HTTP call; wraps decrypt in try/catch converting crypto errors to `Error('User not connected to Calendly')`
- `calendlyRequest()` 401-refresh path now stores `encrypt(newTokens.access_token)` and `encrypt(newTokens.refresh_token)` — refresh sub-path no longer reverts rows to plaintext
- `cancelBookingWithRetry()` in `src/app/api/webhooks/calendly/route.ts` now calls `decrypt(user.calendlyAccessToken)` and `decrypt(user.calendlyRefreshToken!)` before `cancelCalendlyEvent()`; same corrupted-envelope guard added
- `cancelBookingWithRetry()` 401-refresh path now stores encrypted new tokens before Prisma update
- Both files import `{ encrypt, decrypt }` from `@/lib/encryption`
- 5 tests written and passing across 2 test files; full suite 47/47 pass

## Task Commits

Each phase committed atomically:

1. **RED phase** — `a2273c3` `test(02-02): add failing tests for token decrypt-on-read and encrypt-on-refresh`
2. **GREEN phase** — `6abf8b1` `feat(02-02): add decrypt-on-read and encrypt-on-refresh to both Calendly token paths`

**Refactor phase:** Skipped — try/catch pattern is identical but trivially short in each file; extraction adds a cross-file dependency for minimal gain.

## Files Created/Modified

- `src/lib/calendly.test.ts` — 3 tests: happy path decrypt, 401 refresh path with decrypt + encrypt-on-write, corrupted envelope error propagation
- `src/app/api/webhooks/calendly/route.test.ts` — 2 tests via POST handler integration: happy path decrypt, 401 refresh path with decrypt + encrypt-on-write
- `src/lib/calendly.ts` — Added `import { encrypt, decrypt }` on line 3; `calendlyRequest()`: decrypt both tokens before use, encrypt new tokens in 401 refresh path, try/catch around decrypt
- `src/app/api/webhooks/calendly/route.ts` — Added `import { encrypt, decrypt }` on line 7; `cancelBookingWithRetry()`: decrypt both tokens before use, encrypt new tokens in 401 refresh path, try/catch around decrypt

## Test Details (RED commit: a2273c3 / GREEN commit: 6abf8b1)

### src/lib/calendly.test.ts

1. `calendlyRequest: decrypts the access token before passing it to the API call (happy path)` — verifies `decrypt(encryptedToken)` called; `requestFn` called with plaintext, not envelope
2. `calendlyRequest: uses decrypted refresh token on 401 and stores re-encrypted tokens in DB` — verifies `decrypt` called on both tokens; `axios.post` (refreshAccessToken) called with decrypted plaintext; `encrypt` called on new tokens; Prisma update stores `enc:v1:mocked:` prefixed values
3. `calendlyRequest: propagates a user-friendly error when decrypt throws for a corrupted envelope` — verifies `rejects.toThrow('User not connected to Calendly')` and requestFn not called

### src/app/api/webhooks/calendly/route.test.ts

4. `cancelBookingWithRetry: decrypts the access token before calling cancelCalendlyEvent (happy path)` — triggers via POST handler with unapproved invitee; verifies `decrypt` called; `cancelCalendlyEvent` called with plaintext, not envelope
5. `cancelBookingWithRetry: uses decrypted refresh token on 401 and stores re-encrypted tokens in DB` — triggers 401 on first cancel; verifies `refreshAccessToken` called with decrypted plaintext; Prisma update stores encrypted new tokens

### Mock patterns established

```ts
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((value: string) => `enc:v1:mocked:${value}`),
  decrypt: vi.fn((envelope: string) => {
    if (envelope.startsWith('enc:v1:mocked:')) return envelope.replace('enc:v1:mocked:', '')
    throw new Error('Invalid encryption envelope format or unsupported version')
  }),
}))
```

- Deterministic `enc:v1:mocked:` prefix makes encrypt/decrypt assertions exact and readable
- `vi.useFakeTimers()` + `vi.runAllTimersAsync()` bypass the 4-second `setTimeout` in the webhook route

## Post-Implementation Grep Verification

```
grep -n "user.calendlyAccessToken\|user.calendlyRefreshToken" src/lib/calendly.ts src/app/api/webhooks/calendly/route.ts
```

Results:
- `calendly.ts:308: accessToken = decrypt(user.calendlyAccessToken);` — inside decrypt
- `calendly.ts:309: refreshToken = decrypt(user.calendlyRefreshToken);` — inside decrypt
- `route.ts:339: if (!user.calendlyAccessToken || !user.calendlyRefreshToken)` — null guard only
- `route.ts:347: accessToken = decrypt(user.calendlyAccessToken)` — inside decrypt
- `route.ts:348: refreshToken = decrypt(user.calendlyRefreshToken!)` — inside decrypt

All token value usages (not null guards) are inside `decrypt()`.

## Deviations from Plan

None — plan executed exactly as written. Refactor phase intentionally skipped per plan condition ("if the try/catch pattern is identical in both files — otherwise skip").

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- TOK-03 closed
- Plan 03 (migration script for existing plaintext rows) can now proceed — both write path (Plan 01) and read path (Plan 02) are in place

## Self-Check: PASSED

- FOUND: src/lib/calendly.ts — contains `decrypt(user.calendlyAccessToken` and `encrypt(newTokens.access_token)`
- FOUND: src/app/api/webhooks/calendly/route.ts — contains `decrypt(user.calendlyAccessToken` and `encrypt(newTokens.access_token)`
- FOUND: src/lib/calendly.test.ts — 3 tests, 33+ lines
- FOUND: src/app/api/webhooks/calendly/route.test.ts — 2 tests, 30+ lines
- FOUND commit a2273c3 (RED: failing tests)
- FOUND commit 6abf8b1 (GREEN: implementation)
- All 47 vitest tests pass
- TypeScript: no errors in calendly or webhook files

---
*Phase: 02-token-security-webhook-hardening*
*Completed: 2026-02-22*

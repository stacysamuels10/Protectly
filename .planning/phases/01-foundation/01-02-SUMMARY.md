---
phase: 01-foundation
plan: 02
subsystem: security
tags: [encryption, aes-256-gcm, tdd, crypto, typescript]

# Dependency graph
requires:
  - "src/env.ts — env.ENCRYPTION_KEY validated at startup (from plan 01)"
provides:
  - "src/lib/encryption.ts — AES-256-GCM encrypt/decrypt functions"
  - "enc:v1: envelope format for version-aware ciphertext storage"
affects:
  - 02-01
  - 02-02

# Tech tracking
tech-stack:
  added:
    - "@testing-library/dom@^10.4.1 — restored missing transitive dep for @testing-library/react"
  patterns:
    - "AES-256-GCM with 12-byte random IV per call — no IV reuse, authenticated encryption"
    - "Version-prefixed envelope: enc:v1:{ivHex}:{authTagHex}:{ciphertextHex}"
    - "Key read once at module load from env.ENCRYPTION_KEY (leaf module pattern)"
    - "vi.mock('@/env') in test files to isolate encryption logic from full env validation"

key-files:
  created:
    - src/lib/encryption.ts
    - src/lib/encryption.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Mock @/env in encryption test: Stripe keys absent from .env.local; mock provides only ENCRYPTION_KEY needed for test"
  - "enc:v1: version prefix: enables key rotation — future versions can detect old envelopes and re-encrypt"
  - "12-byte IV for GCM: NIST SP 800-38D recommended size for counter-based GCM nonce"
  - "KEY read at module init: fails fast if ENCRYPTION_KEY is malformed before any request hits"

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 1 Plan 02: AES-256-GCM Encryption Primitive Summary

**AES-256-GCM encrypt/decrypt utility with version-prefixed ciphertext envelope and random IV per call — 4 tests green**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T15:36:27Z
- **Completed:** 2026-02-22T15:42:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 4 (encryption.ts, encryption.test.ts, package.json, package-lock.json)

## Accomplishments

- Created `src/lib/encryption.test.ts` with 4 vitest test cases covering: roundtrip, random IV, tampered ciphertext, invalid envelope format (RED phase)
- Created `src/lib/encryption.ts` implementing AES-256-GCM encrypt/decrypt using Node.js built-in `crypto` — all 4 tests pass (GREEN phase)
- Fixed pre-existing vitest setup breakage (`@testing-library/dom` missing, caused all test suites to fail)

## Function Signatures and Envelope Format

```typescript
// src/lib/encryption.ts

export function encrypt(plaintext: string): string
// Returns: "enc:v1:{ivHex}:{authTagHex}:{ciphertextHex}"
// - iv: 12 random bytes (96-bit) per call via crypto.randomBytes(12)
// - authTag: 16 bytes (128-bit GCM tag)
// - ciphertext: AES-256-GCM encrypted plaintext

export function decrypt(envelope: string): string
// Parses enc:v1: prefix, reconstructs iv/authTag/ciphertext from hex
// Throws: Error('Invalid encryption envelope format or unsupported version') if prefix invalid
// Throws: if GCM auth tag validation fails (tampered data or wrong key)
```

**Envelope format:** `enc:v1:{12-byte iv as hex}:{16-byte auth tag as hex}:{n-byte ciphertext as hex}`

The `enc:v1:` prefix enables future key rotation — a `decrypt()` implementation can detect `enc:v2:` envelopes and use a different key/algorithm.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Write failing tests** - `e535016` (test)
2. **Task 2 (GREEN): Implement encryption.ts** - `82042fc` (feat)
3. **Rule 3 Auto-fix: Install @testing-library/dom** - `1306a26` (fix)

## Files Created/Modified

- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt; imports only `crypto` (built-in) and `@/env`; KEY read once at module load
- `src/lib/encryption.test.ts` — 4 vitest test cases; mocks `@/env` with real ENCRYPTION_KEY value
- `package.json` — `@testing-library/dom@^10.4.1` added (missing transitive dep restored)
- `package-lock.json` — lock file updated

## Decisions Made

- **Mock @/env in test:** The full env schema requires Stripe keys (sk_*, price_*, whsec_*) not present in .env.local. Rather than polluting .env.local with fake Stripe keys, the test uses `vi.mock('@/env', () => ({ env: { ENCRYPTION_KEY: '...' } }))` to provide only what encryption.ts needs. The ENCRYPTION_KEY value used matches the real .env.local key.
- **enc:v1: version prefix:** Forward-compatibility for key rotation. Phase 2 can store `enc:v1:` ciphertext in DB; a future migration plan can read old records and write `enc:v2:` with a new key, detected by prefix.
- **12-byte IV:** NIST SP 800-38D recommends 12-byte (96-bit) nonces for GCM to avoid counter collision. Fixed-length also makes envelope parsing unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @testing-library/dom to unblock vitest**
- **Found during:** Task 1 (RED phase) when attempting to run vitest
- **Issue:** `@testing-library/react@16` requires `@testing-library/dom` as a peer dependency, but it was absent from node_modules. The global `src/test/setup.ts` (loaded for ALL test suites) imports from `@testing-library/react`, so every vitest run failed immediately with "Cannot find module '@testing-library/dom'"
- **Fix:** `npm install @testing-library/dom --legacy-peer-deps` — added as explicit devDependency so future `npm install` reliably restores it
- **Files modified:** package.json, package-lock.json
- **Commit:** 1306a26

**2. [Rule 2 - Security/Correctness] Mocked @/env in test file**
- **Found during:** Task 1 (RED phase) — planning the test approach
- **Issue:** Importing `./encryption` triggers `import { env } from '@/env'` which runs createEnv() validation requiring all 14 server vars including Stripe keys absent from .env.local
- **Fix:** Used `vi.mock('@/env', () => ({ env: { ENCRYPTION_KEY: '...' } }))` at the top of the test file. The mock provides the real ENCRYPTION_KEY value from .env.local so crypto operations use the actual key. This is strictly better than adding fake Stripe keys to .env.local.
- **Files modified:** src/lib/encryption.test.ts (mock block added)
- **Impact:** No change to encryption.ts implementation; tests still verify real crypto behavior

## Self-Check

Files created:

- `src/lib/encryption.ts` — FOUND
- `src/lib/encryption.test.ts` — FOUND

Commits:

- `e535016` (test RED) — FOUND
- `82042fc` (feat GREEN) — FOUND
- `1306a26` (fix auto-fix) — FOUND

Tests: 4 passed, 0 failed

TypeScript: No errors in src/lib/encryption.ts

## Self-Check: PASSED

## Next Phase Readiness

- `encrypt()` and `decrypt()` ready for Phase 2 token storage — import via `import { encrypt, decrypt } from '@/lib/encryption'`
- Envelope format `enc:v1:...` ready to be stored in Prisma `String` columns for Calendly OAuth tokens
- Module has zero dependencies on Prisma, session, or HTTP layers — safe to import anywhere without circular dependency risk

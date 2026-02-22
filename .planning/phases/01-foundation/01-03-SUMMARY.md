---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [env, t3-oss, validation, security, webhooks, oauth, stripe, calendly, session]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "Typed env object (src/env.ts) with validated environment variables"
provides:
  - "session.ts reads SESSION_SECRET and NODE_ENV from typed env object"
  - "stripe.ts reads all 5 Stripe env vars from typed env object"
  - "calendly.ts reads all 4 Calendly OAuth vars from typed env object"
  - "Calendly webhook route has unconditional signature verification — conditional bypass removed"
affects:
  - 01-foundation/01-04
  - 02-token-encryption

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All security-sensitive lib files import env from @/env instead of raw process.env"
    - "Unconditional webhook signature verification — no conditional bypass path"

key-files:
  created: []
  modified:
    - src/lib/session.ts
    - src/lib/stripe.ts
    - src/lib/calendly.ts
    - src/app/api/webhooks/calendly/route.ts

key-decisions:
  - "Webhook signature verification is now unconditional — env.CALENDLY_WEBHOOK_SIGNING_KEY is always required at startup (enforced by env schema from Plan 01)"
  - "Non-null ! assertions on env vars removed throughout — typed env.* is already string, never string | undefined"
  - "prisma.ts intentionally left untouched — Prisma reads DATABASE_URL from process.env by design"

patterns-established:
  - "Env consumer pattern: import { env } from '@/env' at top of file; use env.* everywhere; no process.env.*"
  - "Security hardening pattern: unconditional verification — never guard security checks on optional config"

requirements-completed: [ENV-01, ENV-02]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 01 Plan 03: Env Consumer Migration Summary

**All security-critical lib files migrated from raw process.env to typed env object; Calendly webhook signature verification made unconditional, closing conditional bypass security gap**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T15:36:30Z
- **Completed:** 2026-02-22T15:43:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Migrated `session.ts` to use `env.SESSION_SECRET` and `env.NODE_ENV` — no more `as string` cast on process.env
- Migrated `stripe.ts` to use all 5 Stripe env vars from typed env object — no more `!` non-null assertions
- Migrated `calendly.ts` to use all 4 Calendly OAuth vars from typed env object — `getCalendlyAuthUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()` all updated
- Closed the Calendly webhook security bypass: removed `if (webhookSigningKey)` conditional guard; signature verification is now unconditional using `env.CALENDLY_WEBHOOK_SIGNING_KEY`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update session.ts and stripe.ts to use env** - `d5324ed` (feat)
2. **Task 2: Update calendly.ts and webhook route; remove conditional bypass** - `9c78831` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/lib/session.ts` - Replaced `process.env.SESSION_SECRET as string` with `env.SESSION_SECRET`; replaced `process.env.NODE_ENV` with `env.NODE_ENV`
- `src/lib/stripe.ts` - Replaced `process.env.STRIPE_SECRET_KEY!` and all 4 `STRIPE_PRICE_*!` references with typed env equivalents; removed `!` assertions
- `src/lib/calendly.ts` - Replaced all `process.env.CALENDLY_CLIENT_ID!`, `CALENDLY_CLIENT_SECRET`, `CALENDLY_REDIRECT_URI!` accesses across 3 functions with typed env equivalents
- `src/app/api/webhooks/calendly/route.ts` - Removed `const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY`, removed `!!webhookSigningKey` log, replaced conditional `if (webhookSigningKey) {...}` block with unconditional signature verification using `env.CALENDLY_WEBHOOK_SIGNING_KEY`

## Decisions Made

- `verifyWebhookSignature` in `src/lib/webhook.ts` already accepts `signatureHeader: string | null` and handles null gracefully (returns false immediately) — no extra null guard needed in route.ts
- `prisma.ts` intentionally excluded from migration — Prisma reads `DATABASE_URL` from `process.env` by design; injecting `env.DATABASE_URL` into the constructor would break Prisma internals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `.next/types/cache-life.d 2.ts` (duplicate identifiers) and a test file error in `src/components/ui/button.test.tsx` were present before this plan and are unrelated to these changes. All 4 target files compile cleanly.

## User Setup Required

None - no external service configuration required. All env vars were made required in Plan 01-01.

## Next Phase Readiness

- Zero raw `process.env` accesses remain in `session.ts`, `stripe.ts`, `calendly.ts`, or the Calendly webhook route
- Webhook signature verification is unconditional — security gap closed
- All 4 files use typed env from `src/env.ts`; any missing env var causes fail-fast at startup before any request is served
- Ready for Plan 04 or Phase 02 work

---
*Phase: 01-foundation*
*Completed: 2026-02-22*

## Self-Check: PASSED

- src/lib/session.ts: FOUND
- src/lib/stripe.ts: FOUND
- src/lib/calendly.ts: FOUND
- src/app/api/webhooks/calendly/route.ts: FOUND
- .planning/phases/01-foundation/01-03-SUMMARY.md: FOUND
- Commit d5324ed (Task 1): FOUND
- Commit 9c78831 (Task 2): FOUND

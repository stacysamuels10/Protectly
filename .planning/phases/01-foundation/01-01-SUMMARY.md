---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [env, zod, t3, typescript, security, encryption]

# Dependency graph
requires: []
provides:
  - "src/env.ts — Zod-validated typed env object via @t3-oss/env-nextjs createEnv()"
  - "ENCRYPTION_KEY — 64-char hex key generated and added to .env.local"
  - "@t3-oss/env-nextjs — installed as dependency"
affects:
  - 01-02
  - 01-03
  - 01-04
  - 01-05

# Tech tracking
tech-stack:
  added:
    - "@t3-oss/env-nextjs@0.13.10 — startup env validation with Next.js server/client namespace separation"
  patterns:
    - "Single typed env object from src/env.ts replaces all scattered process.env accesses"
    - "Fail-fast startup: ZodError thrown before any request handler runs if required var is missing"
    - "Leaf module pattern: src/env.ts imports only @t3-oss/env-nextjs and zod — never src/lib/*"

key-files:
  created:
    - src/env.ts
  modified:
    - package.json
    - package-lock.json
    - .env.local (gitignored — ENCRYPTION_KEY added; not committed)

key-decisions:
  - "ENCRYPTION_KEY stored as 64 hex chars (32 bytes) — matches AES-256-GCM key size requirement"
  - "CALENDLY_WEBHOOK_SIGNING_KEY made required with no default — closes conditional bypass security gap in webhook route"
  - "SESSION_SECRET enforces .min(32) with no default (ENV-02) — existing dev value of 57 chars already satisfies this"
  - "Stripe price IDs made required in schema — matches existing non-null assertions; CI environments must set these"
  - "NODE_ENV is the only var with .default('development') — safe because it has no security implications"
  - "src/env.ts placed at src/ root per T3 convention, not src/lib/env.ts — avoids circular import risk"

patterns-established:
  - "Pattern: import { env } from '@/env' at top of any file needing env vars"
  - "Pattern: runtimeEnv must be kept in sync with server/client blocks — every new var needs both"
  - "Pattern: Production ENCRYPTION_KEY and Stripe secrets must be set in Railway/Vercel dashboard separately"

requirements-completed:
  - ENV-01
  - ENV-02

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 1 Plan 01: Environment Validation Summary

**Zod-validated startup env guard via @t3-oss/env-nextjs with AES-256-GCM ENCRYPTION_KEY generation — app refuses to start without all 14 required server vars**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T15:30:20Z
- **Completed:** 2026-02-22T15:33:30Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, src/env.ts) + .env.local (gitignored)

## Accomplishments

- Installed @t3-oss/env-nextjs@0.13.10; zod@3.25.76 already installed satisfies peer dep
- Generated 64-char hex ENCRYPTION_KEY via crypto.randomBytes(32) and added to .env.local
- Created src/env.ts with all 14 server vars declared; SESSION_SECRET enforces .min(32) (ENV-02); ENCRYPTION_KEY enforces .length(64) + hex regex; CALENDLY_WEBHOOK_SIGNING_KEY is required with no default (closes conditional bypass security gap)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @t3-oss/env-nextjs and generate ENCRYPTION_KEY** - `a25e75d` (chore)
2. **Task 2: Create src/env.ts with full Zod-validated env schema** - `75c06f5` (feat)

## Files Created/Modified

- `src/env.ts` — createEnv() with full server (14 vars), client (1 var), and runtimeEnv block; leaf module with no src/lib imports
- `package.json` — @t3-oss/env-nextjs@^0.13.10 added to dependencies
- `package-lock.json` — lock file updated
- `.env.local` (gitignored) — ENCRYPTION_KEY=c4a368b1... (64 hex chars) added

## Decisions Made

- **ENCRYPTION_KEY format:** 64 hex characters representing 32 bytes — required by AES-256-GCM cipher used in plan 02's encryption module. Generated once per environment; production/staging keys must be set in Railway/Vercel dashboards manually.
- **CALENDLY_WEBHOOK_SIGNING_KEY required:** Removing the `if (webhookSigningKey)` conditional from the webhook route is plan 03's job, but making the env var required at startup enforces the security property. The conditional is now dead code that a future plan will clean up.
- **Stripe price IDs required:** Made required to match existing `!` non-null assertions in stripe.ts. Any CI environment that lacks these must add them as secrets.
- **node_modules reinstall:** The existing node_modules had a filesystem conflict (ENOTEMPTY on @babel/parser rename during npm install). Auto-fixed by removing node_modules and running fresh npm install before adding the new package. All dependencies restored cleanly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleared corrupted node_modules before installing @t3-oss/env-nextjs**
- **Found during:** Task 1 (package installation)
- **Issue:** npm install failed with ENOTEMPTY: cannot rename /node_modules/@babel/parser — filesystem lock from a prior interrupted install
- **Fix:** Removed entire node_modules directory, ran fresh npm install --legacy-peer-deps to restore all dependencies, then installed @t3-oss/env-nextjs
- **Files modified:** package-lock.json regenerated (dependency counts changed from 748 → 751 after adding new package)
- **Verification:** npm install exited 0; @t3-oss/env-nextjs appears in package.json dependencies; Prisma client regenerated via postinstall hook
- **Committed in:** a25e75d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to unblock package installation. No scope creep — only the target package was added.

## Issues Encountered

- node_modules filesystem conflict (ENOTEMPTY) on initial npm install attempt — resolved by fresh reinstall (see deviations above)
- TypeScript compile check shows pre-existing errors in .next/types and src/components/ui/button.test.tsx — these are out-of-scope pre-existing issues; src/env.ts itself compiles cleanly with zero errors

## User Setup Required

**Production/staging environments:** The ENCRYPTION_KEY generated in this plan is for local development only (in .env.local, which is gitignored). You must set a separate ENCRYPTION_KEY in each production/staging environment:

```bash
# Generate a fresh key for each environment:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to Railway dashboard: Settings > Variables > ENCRYPTION_KEY
Add to Vercel dashboard: Settings > Environment Variables > ENCRYPTION_KEY

Also ensure these vars are set in Railway/Vercel for production:
- STRIPE_SECRET_KEY (sk_live_...)
- STRIPE_WEBHOOK_SECRET (whsec_...)
- STRIPE_PRICE_PRO_MONTHLY (price_...)
- STRIPE_PRICE_PRO_YEARLY (price_...)
- STRIPE_PRICE_BUSINESS_MONTHLY (price_...)
- STRIPE_PRICE_BUSINESS_YEARLY (price_...)

## Next Phase Readiness

- `env` object ready for import in plan 02 (encryption.ts) — `env.ENCRYPTION_KEY` provides the validated 64-char hex key
- `env.SESSION_SECRET` ready for plan 03 (session.ts consumer update) — guaranteed non-null string
- `env.CALENDLY_WEBHOOK_SIGNING_KEY` ready for plan 03 (webhook route unconditional use)
- All Stripe env vars validated and typed — plan 03 can update stripe.ts to use `env.*` without null assertions

---
*Phase: 01-foundation*
*Completed: 2026-02-22*

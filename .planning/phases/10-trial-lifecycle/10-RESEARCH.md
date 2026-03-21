# Phase 10: Trial Lifecycle - Research

**Researched:** 2026-03-21
**Domain:** Vercel Cron, trial state machine, idempotent database writes, transactional email
**Confidence:** HIGH — all infrastructure (cron, email, schema) verified by reading actual source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Daily cron at 9am UTC (`0 9 * * *` in vercel.json). Warning emails arrive during business hours for US/EU users.
- **D-02:** Allowlists are kept in database when downgraded — no data deletion. FREE tier limits enforced at runtime by existing TIER_LIMITS logic.
- **D-03:** Booking protection continues on FREE tier with FREE limits. Core value (automatic cancellation) still works for downgraded users.
- **D-04:** Downgrade only changes `subscriptionTier` to FREE and `subscriptionStatus` to ACTIVE. No other data modifications.
- **D-05 (Phase 8):** `sendEmail()` at `src/lib/email.ts` — Resend singleton
- **D-06 (Phase 8):** TrialExpiry3Days, TrialExpiry1Day, TrialExpired templates exist at `src/emails/`
- **D-07 (Phase 8):** `emailTrialWarnings` boolean on User model (default true)
- **D-08 (Phase 8):** `trialEndsAt` field + `@@index([trialEndsAt])` already on User model
- **D-09 (Research):** Write-first, email-second ordering — database state updated before email sent to prevent duplicate emails on retry
- **D-10 (Research):** `export const dynamic = 'force-dynamic'` required on cron route to prevent static generation
- **D-11 (Research):** CRON_SECRET bearer token guard — reject requests without valid token

### Claude's Discretion

- Exact Prisma queries for finding users at each stage (3-day warning, 1-day warning, expired)
- Idempotency mechanism (status guard in updateMany WHERE clause vs separate tracking table)
- Whether to batch email sends or send individually
- Logging detail level for cron execution summary
- Error handling for partial failures (some emails succeed, some fail)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAL-01 | Expired trials automatically downgrade user to FREE tier via daily Vercel Cron job | Cron infrastructure confirmed: `vercel.json` has empty `"crons": []`, ready to populate. `prisma.user.updateMany` with `WHERE subscriptionStatus = TRIALING AND trialEndsAt < now` is the idempotent downgrade mechanism. |
| TRIAL-02 | User receives warning emails before trial expires (3 days before and on expiry day) and notification when downgraded | All three email templates confirmed present with typed props. `sendEmail()` utility confirmed. `emailTrialWarnings` guard on User model confirmed. Write-first ordering prevents duplicates on retry. |
</phase_requirements>

---

## Summary

Phase 10 is the final v1.0 milestone requirement. All infrastructure this phase depends on is already built and confirmed in the codebase: the Prisma schema has `trialEndsAt` with a database index and `emailTrialWarnings` on the User model; `sendEmail()` and all three trial email templates exist with typed props; `vercel.json` has an empty `crons: []` array ready for population; `CRON_SECRET` is the only missing env var (not yet in `env.ts`).

The core implementation is a single new file: `src/app/api/cron/trial-expiry/route.ts`. It is a GET handler that checks `Authorization: Bearer <CRON_SECRET>`, queries three user cohorts (expired, expiring in 1 day, expiring in 3 days), runs write-first then email-second per cohort, and returns a summary. The critical design decision — already locked by CONTEXT.md — is write-first ordering: `updateMany` before `sendEmail`. This makes the job safe under at-least-once delivery because a re-run after the DB write produces zero affected rows and skips both the write and the email.

The "1-day warning vs same-day downgrade" overlap is the trickiest part: a user whose `trialEndsAt` is today receives both a TrialExpiry1Day email AND is downgraded in the same cron run. The implementation handles this by running the expired cohort first (downgrade + TrialExpired email), then the warning cohorts. Users processed by the expired cohort are excluded from warning cohorts by their changed `subscriptionStatus`.

**Primary recommendation:** Build the cron handler as a single plan. The only new file is the route; the only config change is `vercel.json` and adding `CRON_SECRET` to `env.ts`. No new packages, no schema migration.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Already At | Purpose | Notes |
|---------|-----------|---------|-------|
| `@prisma/client` | 5.7.1 | `updateMany` for idempotent downgrade, `findMany` for cohort queries | `@@index([trialEndsAt])` already on User model |
| `resend` | 6.9.4 | Email delivery via `sendEmail()` | Already wired in `src/lib/email.ts` |
| `react-email` | 5.2.10 | Trial email template rendering | Three templates confirmed present |
| `pino` | 10.3.1 | Cron execution logging | `logger` singleton at `src/lib/logger.ts` |
| `next` | 15.1.3 | Route Handler hosting for cron endpoint | `force-dynamic` + `runtime = 'nodejs'` required |

**No `npm install` needed.** All dependencies are present.

### New Environment Variable

| Variable | Type in env.ts | Required | Notes |
|----------|---------------|----------|-------|
| `CRON_SECRET` | `z.string().min(1)` | Required (not optional) | Vercel sends this as `Authorization: Bearer` on cron invocations. Must also be added to `runtimeEnv` mapping. |

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
└── app/
    └── api/
        └── cron/
            └── trial-expiry/
                ├── route.ts       # GET handler — CRON_SECRET guard + trial logic
                └── route.test.ts  # Vitest unit tests
```

One new directory. Two new files.

### Pattern 1: Cron Route with CRON_SECRET Bearer Guard

**What:** GET handler with immediate auth check before any business logic.
**When to use:** Every Vercel Cron endpoint — mandatory.

```typescript
// src/app/api/cron/trial-expiry/route.ts
import type { NextRequest } from 'next/server'
import { env } from '@/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... trial logic
}
```

Both exports are mandatory:
- `dynamic = 'force-dynamic'` — prevents Next.js static caching of the route (PITFALL-7 in PITFALLS.md)
- `runtime = 'nodejs'` — required for Prisma (Edge Runtime does not support Prisma client)

### Pattern 2: Write-First Idempotent Downgrade

**What:** `updateMany` with a WHERE clause that only matches users still in TRIALING status. Use the `count` from the result to decide whether to send the email.
**When to use:** All state transitions in cron jobs.

```typescript
// Source: verified against prisma/schema.prisma — subscriptionStatus field confirmed
const now = new Date()

const result = await prisma.user.updateMany({
  where: {
    subscriptionStatus: 'TRIALING',
    trialEndsAt: { lt: now },
  },
  data: {
    subscriptionTier: 'FREE',
    subscriptionStatus: 'ACTIVE',
  },
})
// result.count = number of rows actually changed
// On re-run: result.count = 0 (status is already ACTIVE, WHERE clause excludes them)
```

For emails, fetch the users BEFORE the updateMany (to get their email address and name), then send only if count > 0. The cleanest pattern:

```typescript
// 1. Find candidates
const expiredUsers = await prisma.user.findMany({
  where: {
    subscriptionStatus: 'TRIALING',
    trialEndsAt: { lt: now },
  },
  select: { id: true, email: true, name: true, emailTrialWarnings: true },
})

// 2. Write first
const { count } = await prisma.user.updateMany({
  where: {
    subscriptionStatus: 'TRIALING',
    trialEndsAt: { lt: now },
  },
  data: { subscriptionTier: 'FREE', subscriptionStatus: 'ACTIVE' },
})

// 3. Email second (only for users the write actually changed)
// count === expiredUsers.length on first run; 0 on re-run
if (count > 0) {
  for (const user of expiredUsers) {
    if (user.emailTrialWarnings) {
      try {
        await sendEmail({ to: user.email, subject: '...', react: TrialExpired({...}) })
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send trial expired email')
        // continue — do not abort the loop
      }
    }
  }
}
```

**Why this works for idempotency:** If the function crashes between write and email, re-run finds 0 users in TRIALING status with `trialEndsAt < now` (they're now ACTIVE). No duplicate downgrade, no duplicate email.

**Edge case:** If `findMany` runs, then a concurrent upgrade happens (user subscribes), then `updateMany` runs — the WHERE clause correctly skips the now-PAID user because their `subscriptionStatus` is no longer TRIALING.

### Pattern 3: Warning Email Cohort Queries (No State Write)

Warning emails (3-day and 1-day) do not change subscription state. Idempotency for these comes from the email template being the same if sent twice — it is acceptable to re-send a warning on retry. The cron's at-least-once delivery is mitigated by the fact warnings are informational, not billing-critical.

**3-day window query:**
```typescript
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
const twoDaysFromNow   = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

const threeDay = await prisma.user.findMany({
  where: {
    subscriptionStatus: 'TRIALING',
    trialEndsAt: {
      gte: twoDaysFromNow,   // more than 2 days away (not already handled by 1-day)
      lte: threeDaysFromNow, // within 3 days
    },
  },
  select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
})
```

**1-day window query:**
```typescript
const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

const oneDay = await prisma.user.findMany({
  where: {
    subscriptionStatus: 'TRIALING',
    trialEndsAt: {
      gte: now,            // not yet expired (expired cohort handles those)
      lte: oneDayFromNow,  // within 24 hours
    },
  },
  select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
})
```

**Important:** Run the expired cohort first. Users whose `trialEndsAt` is today fall into the expired cohort (`lt: now`) AND would also fall within the 1-day window. By processing expired first and updating their status to ACTIVE, the 1-day query's `subscriptionStatus: 'TRIALING'` filter naturally excludes them.

### Pattern 4: Email Template Props (verified against actual files)

All three templates confirmed at `src/emails/trial-expiry-*.tsx`:

```typescript
// TrialExpiry3Days — src/emails/trial-expiry-3days.tsx
TrialExpiry3Days({ userName, trialEndDate, upgradeUrl })
// Props: userName: string, trialEndDate: string, upgradeUrl: string

// TrialExpiry1Day — src/emails/trial-expiry-1day.tsx
TrialExpiry1Day({ userName, trialEndDate, upgradeUrl })
// Props: userName: string, trialEndDate: string, upgradeUrl: string

// TrialExpired — src/emails/trial-expired.tsx
TrialExpired({ userName, upgradeUrl })
// Props: userName: string, upgradeUrl: string (no trialEndDate — it already expired)
```

**upgradeUrl construction (matches established pattern in calendly/route.ts):**
```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const upgradeUrl = `${appUrl}/dashboard?tab=billing`
```

**trialEndDate formatting:**
```typescript
const trialEndDate = user.trialEndsAt!.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric',
})
// e.g. "March 25, 2026"
```

**userName fallback:**
```typescript
const userName = user.name ?? user.email.split('@')[0]
```

### Pattern 5: Cron Logging Summary

Log one summary line at the end, not per-user. Follows the pino pattern from `src/lib/logger.ts`:

```typescript
logger.info(
  { expired: count, warned1d: oneDay.length, warned3d: threeDay.length },
  'trial-expiry cron complete'
)
```

Return the same summary in the JSON response (useful for Vercel cron log inspection):
```typescript
return Response.json({ ok: true, expired: count, warned1d: oneDay.length, warned3d: threeDay.length })
```

### Pattern 6: vercel.json Population

Current state of `vercel.json` (confirmed by reading file):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": { "maxDuration": 30 }
  },
  "crons": []
}
```

Add to `crons`:
```json
"crons": [
  {
    "path": "/api/cron/trial-expiry",
    "schedule": "0 9 * * *"
  }
]
```

**Hobby plan constraint:** `0 9 * * *` runs once daily — within Hobby plan limits. Any expression that would fire more than once per day causes a deployment failure.

### Pattern 7: CRON_SECRET in env.ts

`CRON_SECRET` is not currently in `src/env.ts` (confirmed by reading file). Must add:

```typescript
// In server: block
CRON_SECRET: z.string().min(1),

// In runtimeEnv: block
CRON_SECRET: process.env.CRON_SECRET,
```

**Do NOT make it optional.** If `CRON_SECRET` is absent, the cron endpoint is unguarded. Unlike Sentry/PostHog/Resend vars (which degrade gracefully when absent), a missing cron secret is a security gap. Use `z.string().min(1)` without `.optional()`.

**Consequence:** Local dev and CI must set `CRON_SECRET` in `.env.local` / CI env vars. Use any non-empty string locally (e.g., `CRON_SECRET=dev-secret`).

### Anti-Patterns to Avoid

- **Email before write:** Never send the email before the DB write completes. If the function is killed between email and write, the next run sends a duplicate email. The established pattern (PITFALLS.md Pitfall 8, CONTEXT.md D-09) is write-first.
- **Non-conditional updateMany:** Never `prisma.user.update` (singular) inside a loop. `updateMany` with a WHERE clause is the idempotency mechanism — it is atomic and returns the affected count.
- **Missing `force-dynamic`:** Without `export const dynamic = 'force-dynamic'`, Next.js may statically generate the cron route and the handler never runs. Verified as Pitfall 7 in PITFALLS.md.
- **Missing `runtime = 'nodejs'`:** Prisma does not run in Edge Runtime. The route must declare Node.js runtime.
- **Optional CRON_SECRET:** Making it `.optional()` allows the server to start without it, leaving the endpoint unprotected if the env var is accidentally omitted.
- **Querying all users without subscriptionStatus filter:** Without `WHERE subscriptionStatus = 'TRIALING'`, users who already upgraded to PRO/BUSINESS or were manually set to ACTIVE would appear in the expired cohort.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotency tracking | Separate `CronExecution` table with processed user IDs | `updateMany` WHERE clause | The `subscriptionStatus` field IS the idempotency state. Using it as the guard is zero overhead and already the correct data model. |
| Distributed lock | Custom Upstash lock wrapper | Not needed for this phase | At Protectly's scale, the cron job completes in milliseconds. Vercel does not run two instances of the same cron simultaneously at this tier. A Redis lock adds complexity without value. Revisit if the user base grows to 10k+ and query time approaches the cron window. |
| Email templating | HTML string construction | Existing `src/emails/trial-*.tsx` templates | Templates already exist with typed props. Use them directly. |
| Cron scheduling | `node-cron` or `setTimeout` | Vercel Cron via `vercel.json` | No persistent process in serverless. Vercel Cron is the only correct approach. |
| Date window calculation | Moment.js or date-fns | Native `Date` arithmetic | Window calculations are simple additions (N * 24 * 60 * 60 * 1000). No library needed. |

---

## Common Pitfalls

### Pitfall 1: Missing `force-dynamic` Causes Silent No-Op in Production

**What goes wrong:** The cron fires, Vercel logs show `200 OK`, but no trials are ever downgraded. The route was statically generated at build time and the cached response is returned.

**Why it happens:** Next.js 15 aggressively caches routes. A GET handler with no detected dynamic dependencies may be compiled as a static page.

**How to avoid:** First two lines of the route file (after imports): `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`. Non-negotiable.

**Warning signs:** Build output shows the cron route as `○` (static) rather than `λ` (serverless function).

### Pitfall 2: 1-Day Warning Users Also Match Expired Cohort If `trialEndsAt` Is Today

**What goes wrong:** A user whose trial ends at 8:59 UTC is in the expired cohort (`trialEndsAt < 9:00 UTC`). If the 1-day window query runs first (or alongside), this user gets both a TrialExpiry1Day email AND a TrialExpired email — two emails in the same cron run.

**How to avoid:** Always run the expired cohort first and commit the status change to ACTIVE. Then run warning cohorts. The `subscriptionStatus: 'TRIALING'` filter on warning queries naturally excludes already-downgraded users.

**Ordering requirement:**
1. Expired cohort: `findMany`, `updateMany`, send TrialExpired emails
2. 1-day warning: `findMany` (TRIALING status, excludes users from step 1), send TrialExpiry1Day emails
3. 3-day warning: `findMany` (TRIALING status), send TrialExpiry3Days emails

### Pitfall 3: `CRON_SECRET` Not Added to env.ts

**What goes wrong:** `process.env.CRON_SECRET` reads as `undefined`. The guard `authHeader !== \`Bearer ${undefined}\`` evaluates to `authHeader !== 'Bearer undefined'`, which means any request with `Authorization: Bearer undefined` passes the check.

**How to avoid:** Add `CRON_SECRET` to `env.ts` as a required server var and use `env.CRON_SECRET` in the route, not `process.env.CRON_SECRET` directly. The env validation will fail fast at startup if the var is missing.

### Pitfall 4: Sending Emails After updateMany Count Is 0

**What goes wrong:** The cron runs twice. Second run: `updateMany` returns `{ count: 0 }`. Code sends emails anyway because it uses the pre-fetched `expiredUsers` array (still populated from the `findMany` before the write). Users get a second TrialExpired email.

**How to avoid:** Gate the email loop on `count > 0`. The write result is the authoritative signal that state actually changed in this invocation.

```typescript
const { count } = await prisma.user.updateMany({ ... })
if (count > 0) {
  // send emails
}
```

### Pitfall 5: Hard-Coded Date Arithmetic Errors Around Midnight UTC

**What goes wrong:** `trialEndsAt` is stored as a timestamp (e.g., `2026-03-25T00:00:00.000Z`). The cron runs at 9:00 UTC. A user whose trial ends at `2026-03-25T00:00:00.000Z` will be in the expired cohort (`lt: now` at 9:00 UTC on March 25). Their 1-day warning was sent at 9:00 UTC on March 24 (when `trialEndsAt` was within 24 hours). This is correct behavior.

**What to watch for:** If `trialEndsAt` is set to end-of-day (e.g., `2026-03-25T23:59:59.000Z`), the user won't appear in the expired cohort until the March 26 cron run. Ensure the subscription creation code sets `trialEndsAt` consistently (likely midnight UTC of the end date).

**This is an observation, not a code change needed.** The existing schema stores `trialEndsAt` as a `DateTime?` — just document the convention.

---

## Code Examples

### Complete Cron Route Structure

```typescript
// src/app/api/cron/trial-expiry/route.ts
import 'server-only'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { env } from '@/env'
import TrialExpiry3Days from '@/emails/trial-expiry-3days'
import TrialExpiry1Day from '@/emails/trial-expiry-1day'
import TrialExpired from '@/emails/trial-expired'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const upgradeUrl = `${appUrl}/dashboard?tab=billing`

  // 2. Expired cohort — write first, email second
  const expiredUsers = await prisma.user.findMany({
    where: { subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now } },
    select: { id: true, email: true, name: true, emailTrialWarnings: true },
  })

  const { count: expiredCount } = await prisma.user.updateMany({
    where: { subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now } },
    data: { subscriptionTier: 'FREE', subscriptionStatus: 'ACTIVE' },
  })

  if (expiredCount > 0) {
    for (const user of expiredUsers) {
      if (!user.emailTrialWarnings) continue
      try {
        await sendEmail({
          to: user.email,
          subject: 'Your PriCal trial has expired',
          react: TrialExpired({
            userName: user.name ?? user.email.split('@')[0],
            upgradeUrl,
          }),
        })
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send trial-expired email')
      }
    }
  }

  // 3. 1-day warning (after expired cohort to avoid double emails)
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const oneDayUsers = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'TRIALING',
      trialEndsAt: { gte: now, lte: oneDayFromNow },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
  })

  for (const user of oneDayUsers) {
    if (!user.emailTrialWarnings) continue
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your PriCal trial expires tomorrow',
        react: TrialExpiry1Day({
          userName: user.name ?? user.email.split('@')[0],
          trialEndDate: user.trialEndsAt!.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          }),
          upgradeUrl,
        }),
      })
    } catch (err) {
      logger.error({ err, userId: user.id }, 'failed to send trial-expiry-1day email')
    }
  }

  // 4. 3-day warning
  const twoDaysFromNow   = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const threeDayUsers = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'TRIALING',
      trialEndsAt: { gte: twoDaysFromNow, lte: threeDaysFromNow },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
  })

  for (const user of threeDayUsers) {
    if (!user.emailTrialWarnings) continue
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your PriCal trial ends in 3 days',
        react: TrialExpiry3Days({
          userName: user.name ?? user.email.split('@')[0],
          trialEndDate: user.trialEndsAt!.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          }),
          upgradeUrl,
        }),
      })
    } catch (err) {
      logger.error({ err, userId: user.id }, 'failed to send trial-expiry-3day email')
    }
  }

  logger.info(
    { expired: expiredCount, warned1d: oneDayUsers.length, warned3d: threeDayUsers.length },
    'trial-expiry cron complete'
  )

  return Response.json({
    ok: true,
    expired: expiredCount,
    warned1d: oneDayUsers.length,
    warned3d: threeDayUsers.length,
  })
}
```

### Test File Pattern (matching email-preferences/route.test.ts style)

```typescript
// src/app/api/cron/trial-expiry/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/env', () => ({
  env: { CRON_SECRET: 'test-secret' },
}))

import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { NextRequest } from 'next/server'

// Tests cover:
// - 401 on missing/wrong Authorization header
// - 200 with expired count when users downgraded
// - email skipped when emailTrialWarnings is false
// - second run produces count=0 and no email
// - email failures logged but do not fail the cron
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.16 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/app/api/cron/trial-expiry/route.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAL-01 | Expired TRIALING user → subscriptionTier=FREE, subscriptionStatus=ACTIVE | unit | `npx vitest run src/app/api/cron/trial-expiry/route.test.ts` | Wave 0 |
| TRIAL-01 | Running twice produces exactly one downgrade (idempotency) | unit | same | Wave 0 |
| TRIAL-01 | GET without valid CRON_SECRET returns 401 | unit | same | Wave 0 |
| TRIAL-02 | TrialExpiry3Days email sent for users expiring in 3 days | unit | same | Wave 0 |
| TRIAL-02 | TrialExpiry1Day email sent for users expiring today | unit | same | Wave 0 |
| TRIAL-02 | TrialExpired email sent on downgrade | unit | same | Wave 0 |
| TRIAL-02 | No email when emailTrialWarnings is false | unit | same | Wave 0 |
| TRIAL-02 | User expiring today: downgraded AND receives TrialExpired (not TrialExpiry1Day) | unit | same | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/app/api/cron/trial-expiry/route.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/cron/trial-expiry/route.test.ts` — covers all TRIAL-01 and TRIAL-02 requirements
- [ ] `src/app/api/cron/trial-expiry/route.ts` — implementation (does not exist yet)

*(Existing test infrastructure — `vitest.config.ts`, `src/test/setup.ts`, `src/__mocks__/server-only.ts` — is fully compatible with the new test file. No framework setup needed.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-cron` on persistent process | Vercel Cron via `vercel.json` | When project moved to Vercel serverless | No persistent process; cron is HTTP GET invocation |
| `prisma.user.update` in loop | `prisma.user.updateMany` with WHERE | Standard Prisma pattern | Single DB round-trip; atomic state check eliminates race |
| Email before DB write | DB write first, email second | CONTEXT.md D-09 decision | Safe under at-least-once delivery; email failure doesn't cause re-downgrade |

---

## Open Questions

1. **`trialEndsAt` value convention: midnight UTC vs. end-of-day UTC**
   - What we know: Field is `DateTime?` in schema; `@@index([trialEndsAt])` exists; trial creation logic is in Stripe webhook handler (subscription created event sets trialEndsAt)
   - What's unclear: Whether Stripe's `trial_end` Unix timestamp is converted to midnight UTC or some other time when stored
   - Recommendation: Read the Stripe webhook handler's `trialEndsAt` assignment before writing the cron's date window queries. If it's midnight UTC, the 9am cron correctly captures "expired yesterday" users. If it's end-of-day, users won't appear until the next day's cron. This is an observability concern, not a blocking issue.

2. **`NEXT_PUBLIC_APP_URL` in server-side cron context**
   - What we know: The existing calendly/route.ts uses `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'` directly (not via env.ts) for constructing email URLs
   - What's unclear: Whether `NEXT_PUBLIC_APP_URL` is reliably set in production (it's `.optional()` in env.ts)
   - Recommendation: Match the established pattern — use `process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'` for upgradeUrl. The fallback is safe; worst case, the link goes to localhost which Resend will still send successfully.

---

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` — confirmed: `trialEndsAt DateTime?`, `@@index([trialEndsAt])`, `emailTrialWarnings Boolean @default(true)`, `subscriptionStatus: TRIALING`, `subscriptionTier: FREE`
- `src/lib/email.ts` — confirmed: `sendEmail({ to, subject, react })` signature
- `src/emails/trial-expiry-3days.tsx` — confirmed props: `{ userName, trialEndDate, upgradeUrl }`
- `src/emails/trial-expiry-1day.tsx` — confirmed props: `{ userName, trialEndDate, upgradeUrl }`
- `src/emails/trial-expired.tsx` — confirmed props: `{ userName, upgradeUrl }`
- `vercel.json` — confirmed: `"crons": []` ready to populate
- `src/env.ts` — confirmed: `CRON_SECRET` not yet present; needs adding as required server var
- `src/app/api/settings/email-preferences/route.ts` — established pattern for route structure
- `src/app/api/settings/email-preferences/route.test.ts` — established vitest mock pattern for this codebase
- `vitest.config.ts` — confirmed test environment setup compatible with new test file
- `.planning/research/ARCHITECTURE.md` — Trial Expiry Cron Flow diagram, idempotency guidance
- `.planning/research/PITFALLS.md` — Pitfall 7 (force-dynamic), Pitfall 8 (write-first ordering)

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — Vercel Cron CRON_SECRET pattern (cross-verified against vercel.json and existing code)
- Vercel Cron docs (referenced in ARCHITECTURE.md) — schedule format, Hobby plan once-per-day limit

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries present, versions confirmed by inspecting installed packages
- Architecture: HIGH — patterns verified against actual codebase files
- Pitfalls: HIGH — cross-referenced against PITFALLS.md (researched against official Vercel/Next.js docs) and confirmed against codebase

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable infrastructure; Vercel Cron API is not fast-moving)

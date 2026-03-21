# Phase 10: Trial Lifecycle - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a daily Vercel Cron endpoint that checks trial expirations, sends warning emails (3 days before and on expiry day), and downgrades expired trials to FREE tier. Must be fully idempotent and secured with CRON_SECRET bearer token.

</domain>

<decisions>
## Implementation Decisions

### Cron Timing
- **D-01:** Daily cron at 9am UTC (`0 9 * * *` in vercel.json). Warning emails arrive during business hours for US/EU users.

### Downgrade Behavior
- **D-02:** Allowlists are kept in database when downgraded — no data deletion. FREE tier limits enforced at runtime by existing TIER_LIMITS logic.
- **D-03:** Booking protection continues on FREE tier with FREE limits. Core value (automatic cancellation) still works for downgraded users.
- **D-04:** Downgrade only changes `subscriptionTier` to FREE and `subscriptionStatus` to ACTIVE. No other data modifications.

### Inherited from Prior Phases
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cron infrastructure
- `.planning/research/ARCHITECTURE.md` — Vercel Cron integration pattern, CRON_SECRET guard
- `.planning/research/PITFALLS.md` — force-dynamic export, at-least-once delivery, idempotency

### Email infrastructure
- `src/lib/email.ts` — sendEmail utility
- `src/emails/trial-expiry-3days.tsx` — TrialExpiry3Days template props
- `src/emails/trial-expiry-1day.tsx` — TrialExpiry1Day template props
- `src/emails/trial-expired.tsx` — TrialExpired template props

### Data model
- `prisma/schema.prisma` — User model with trialEndsAt, subscriptionTier, emailTrialWarnings fields
- `src/lib/utils.ts` — TIER_LIMITS constants for FREE tier enforcement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/email.ts` — `sendEmail({ to, subject, react })` ready to use
- `src/emails/trial-expiry-*.tsx` — Three trial email templates with typed props
- `src/lib/logger.ts` — Structured pino logger for cron execution logging
- `src/env.ts` — Zod env validation; CRON_SECRET should be added here
- `src/lib/prisma.ts` — Prisma client singleton

### Established Patterns
- API routes use `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`
- Email sends wrapped in try/catch (Phase 9 pattern) — failures logged, never thrown
- `prisma.user.updateMany` with WHERE clause for idempotent state transitions
- PostHog tracking with `flushPostHog()` for serverless-safe event capture

### Integration Points
- New route: `src/app/api/cron/trial-expiry/route.ts` — GET handler
- New file: `vercel.json` — cron schedule configuration
- Env var: `CRON_SECRET` added to env.ts as required server var

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard cron + email pattern with idempotency.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-trial-lifecycle*
*Context gathered: 2026-03-21*

# Project Research Summary

**Project:** Protectly v1.0 — Production Infrastructure Milestone
**Domain:** Next.js SaaS — observability, transactional email, trial lifecycle management
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

Protectly v0.1 is complete with a hardened security foundation (Calendly OAuth, webhook-driven booking interception, allowlist CRUD, Stripe billing, encryption, rate limiting, audit logging, 86 passing tests). The v1.0 milestone closes the gap between a working prototype and a production-operable product. The three missing capabilities are: (1) observability — no error monitoring, no structured logging, analytics-blind; (2) user communication — no transactional email, no booking notifications, no trial warnings; and (3) revenue integrity — trials never expire, users stay on PRO indefinitely. All three are fixable with well-established tooling choices that integrate cleanly into the existing Next.js 15 / Prisma / Vercel / Railway stack.

The recommended approach is a strict build order driven by dependencies: structured logging first (pure refactor, immediately observable), Sentry second (captures errors from all subsequent new code), PostHog third (independent of email work), transactional email infrastructure fourth (gating dependency for all notification features), email preferences schema fifth, booking notification emails sixth, and trial expiry cron last (requires a separate `vercel.json` artifact and Vercel plan constraints). This order minimizes risk — every phase is debuggable before the next phase adds complexity, and email templates can be iterated independently of webhook integration logic.

The two highest-risk areas are Sentry configuration and the trial expiry cron. Sentry has three integration pitfalls that can each produce a "looks done but isn't" result: missing `onRequestError` (RSC errors invisible), missing `SENTRY_AUTH_TOKEN` in Vercel (source maps broken), and missing `beforeSend` PII scrubbing (GDPR exposure from Calendly webhook payloads). The cron has two idempotency hazards: statically-generated route handlers that silently no-op, and email-before-database-write ordering that causes duplicate sends on retry. Both areas require explicit verification steps, not just code review.

---

## Key Findings

### Recommended Stack

All net-new packages are narrowly scoped to the v1.0 infrastructure gap. The existing stack (Next.js 15.1.3, iron-session, Prisma 5.7.1, Upstash Redis, Zod env validation, native fetch, Vitest/Playwright) is unchanged. Seven additions are purpose-selected for Next.js 15 App Router compatibility, developer experience, and Vercel serverless runtime behavior.

**Core technologies:**
- `@sentry/nextjs@10.45.0` — error monitoring — only official SDK with Next.js App Router `onRequestError` hook and automatic `withSentryConfig` source map upload; run wizard to generate all four instrumentation entry points
- `posthog-js@1.363.1` — client-side analytics — browser SDK; wrap app in `PHProvider` in a separate `'use client'` file, never in `layout.tsx` directly
- `posthog-node@5.28.5` — server-side analytics — required separately from `posthog-js` for Route Handlers and Server Actions; must use `flushAt: 1, flushInterval: 0` in serverless
- `resend@6.9.4` — transactional email — modern developer-first API, React Email native support, 3,000 emails/mo free, SOC 2 compliant
- `react-email@5.2.10` + `@react-email/components` — email templates — write email HTML as TSX; React 19 compatible; avoids raw HTML template maintenance burden
- `pino@10.3.1` — structured JSON logging — replaces `console.log/error` throughout; JSON output in production, pretty-printed in dev; must be in `serverExternalPackages` in `next.config.ts`
- `pino-pretty@13.1.3` — dev-only pretty logging — `devDependencies` only; never runs in production
- Vercel Cron (no package) — scheduled trial expiry — requires only `vercel.json` configuration + a Route Handler with `CRON_SECRET` bearer guard

**Critical version constraints:**
- `@sentry/nextjs >= 8.28.0` required for `onRequestError` RSC error capture (pinned at 10.45.0)
- Current project is on Next.js 15.1.3; Turbopack source map upload requires 15.4.1+ — use webpack upload path (fully supported at 15.1.3)
- Vercel Hobby plan: cron max once per day; `0 9 * * *` (daily at 09:00 UTC) is within limits

**What NOT to use:** `@posthog/next@0.1.0` (alpha), `node-cron`/`cron` npm packages (no persistent process in serverless), `nodemailer` (SMTP complexity), `winston` (4x slower than pino), `@sentry/node` bare (missing App Router instrumentation), `SendGrid` (shared IP pools degrade transactional deliverability).

See `.planning/research/STACK.md` for full installation commands, alternatives analysis, and new environment variables.

---

### Expected Features

Protectly is missing all production-readiness infrastructure. Every P1 item is a gap relative to any comparable production SaaS.

**Must have (P1 — production readiness or revenue integrity):**
- Sentry error monitoring — production errors currently invisible; first feature to add
- Structured JSON logging (Pino) — `console.log` is unsearchable in Vercel; required for production debugging
- Transactional email infrastructure (Resend + React Email) — gating dependency for all notification features
- Trial expiration enforcement (Vercel Cron + downgrade logic) — revenue leak; users currently stay on PRO indefinitely after trial
- Trial expiry warning emails (3-day, expiry-day) — majority of trial-to-paid conversions happen in the last 3 days
- Booking rejected email notification — core product value; users need to know protection is working
- User email notification preferences — CAN-SPAM / GDPR compliance for recurring transactional notifications

**Should have (P2 — meaningful improvement, low cost):**
- PostHog product analytics — not blocking launch but critical for roadmap decisions; add after core infrastructure is stable
- "Add to allowlist" CTA in rejected booking emails — one-click resolution; deep link with `?prefill=email@example.com`
- Booking approved email notification — less urgent than rejected; reuses email infrastructure

**Defer to v2+:**
- Email digest batching for high-volume users — not a current use case
- In-app notification panel (WebSockets/SSE) — Protectly is a background service; users are not watching the dashboard when bookings happen
- Sentry performance tracing — establish error baseline first; add performance traces after

**Anti-features (do not build):** raw HTML email templates, webhook-triggered emails without rate limiting, custom SMTP, real-time in-app notifications, email open/click tracking pixels (Apple Mail Privacy Protection blocks 90%+ of opens; GDPR exposure on transactional emails).

See `.planning/research/FEATURES.md` for full prioritization matrix, dependency graph, and competitor gap analysis.

---

### Architecture Approach

The v1.0 architecture is additive — no existing components are removed or restructured. Two new instrumentation files go at the project root (Next.js requirement), three new `src/lib/` singletons mirror the existing pattern (`prisma.ts`, `stripe.ts`), two new API route namespaces are added (`/api/cron/` and `/api/settings/email-preferences/`), and three boolean columns are added to the Prisma `User` model. The Calendly webhook handler is the only existing hot path that gets modified (structured logging + conditional email sends + PostHog event capture).

**Major components:**
1. `instrumentation.ts` + `instrumentation-client.ts` — Sentry server/edge init and browser Sentry/PostHog init; required at project root
2. `src/lib/logger.ts` — pino singleton with `'server-only'` guard; JSON in production, pretty in dev
3. `src/lib/email.ts` — Resend singleton + `sendEmail()` utility; server-only; React Email components as TSX files in `src/emails/`
4. `src/lib/posthog-server.ts` — posthog-node singleton with `flushAt: 1, flushInterval: 0` for serverless safety
5. `src/components/providers.tsx` — `'use client'` PostHog provider; wraps `{children}` in layout without forcing server components client-side
6. `src/app/api/cron/trial-expiry/route.ts` — daily cron; `export const dynamic = 'force-dynamic'` + `export const runtime = 'nodejs'` required; CRON_SECRET bearer guard; idempotent `updateMany` with status guard; write-first, email-second order
7. `src/app/api/settings/email-preferences/route.ts` — GET + PATCH for user notification toggles
8. Prisma schema — three boolean fields: `emailApprovedBookings`, `emailRejectedBookings`, `emailTrialWarnings` (all `@default(true)`) + `@@index([trialEndsAt])`

**Key patterns:** singleton lib modules for all external service clients; email sends wrapped in `try/catch` (email failure never fails a 200 webhook response); `await posthog.shutdown()` required before returning from every server route that calls `capture()`; CRON_SECRET bearer guard mandatory; trial downgrade uses `prisma.user.updateMany({ where: { ..., subscriptionStatus: 'TRIALING' } })` as idempotency guard.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, build order rationale, scaling considerations, and anti-pattern analysis.

---

### Critical Pitfalls

1. **Sentry `onRequestError` missing** — RSC errors silently swallowed; Sentry dashboard shows zero server errors even when server components are crashing. Requires `@sentry/nextjs >= 8.28.0` and explicit `export const onRequestError = Sentry.captureRequestError` in `instrumentation.ts`. Verify by intentionally throwing in a Server Component and confirming the event in Sentry within 60 seconds.

2. **`SENTRY_AUTH_TOKEN` not set in Vercel** — source map upload silently fails; all production stack traces are unreadable minified code. Build succeeds without error. Set in Vercel environment variables scoped to Build only (not Runtime). Verify readable TypeScript file names in Sentry stack trace before shipping to production.

3. **Sentry PII from Calendly webhook request context** — Default Sentry captures full request body including invitee email addresses and names. Configure `beforeSend` in `sentry.server.config.ts` to strip sensitive fields before the first production deploy — not retroactively.

4. **PostHog server-side events lost in serverless** — posthog-node uses async flush; Vercel freezes the function after response is sent, events are silently dropped. Set `flushAt: 1, flushInterval: 0` on the singleton AND call `await posthog.shutdown()` before returning from every route handler that calls `capture()`.

5. **Vercel Cron route statically generated** — Next.js 15 may cache the cron handler at build time; cron fires and returns 200 but no database changes occur. Add `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`. Verify route shows as `λ` not `○` in build output.

6. **Cron idempotency — email sent before database write** — Vercel cron uses at-least-once delivery; if the function times out after sending email but before writing the status update, the next run re-sends. Write-first, email-second: use `prisma.user.updateMany` with status guard and only send email if `count > 0`.

7. **Pino in Edge Runtime or client bundle** — Pino uses Node.js Worker Threads; Edge Runtime (middleware) does not support them. Add `import 'server-only'` to `lib/logger.ts` and add `'pino', 'pino-pretty', 'thread-stream'` to `serverExternalPackages`. Use `console.log(JSON.stringify(...))` in middleware instead of Pino.

8. **Resend domain not verified at phase start** — DNS propagation takes 24–48 hours. If verification is not started at Phase 4 kickoff, it blocks all email testing. Start domain verification on day one, before writing any code.

See `.planning/research/PITFALLS.md` for the full 10-pitfall analysis with recovery strategies, phase-to-pitfall mapping, and "looks done but isn't" verification checklist.

---

## Implications for Roadmap

A 7-phase structure emerges from the dependency graph. Each phase is independently testable and builds on a stable foundation from the previous phase.

### Phase 1: Structured Logging

**Rationale:** Pure refactor with no external dependencies, no new env vars, no new services. Makes all subsequent phases observable. Eliminates `console.log` before any new code is added, preventing a mixed-format logging problem.
**Delivers:** `src/lib/logger.ts` pino singleton; `serverExternalPackages` config in `next.config.ts`; `console.log/error` replaced across all server-side files
**Addresses:** Production debuggability (table stakes feature)
**Avoids:** Pino Edge Runtime / client bundle failure (Pitfall 7); `console.log` test spy breakage (PITFALLS.md Pitfall 9)
**Pitfall prevention:** Audit `vi.spyOn(console)` test spies before migration; add `import 'server-only'` + `serverExternalPackages` before writing any logging code; run `grep -r "console\.(log|error|warn)" src/` after migration to confirm zero remaining
**Research flag:** Standard patterns — well-documented; skip research-phase

---

### Phase 2: Sentry Error Monitoring

**Rationale:** Second priority after logging. Captures errors from all new code being written in phases 3–7. Must be in place before production traffic hits any new features.
**Delivers:** `@sentry/nextjs` installed via wizard; instrumentation files (server + client + edge); `withSentryConfig` in `next.config.ts`; `global-error.tsx` boundary; `beforeSend` PII scrubbing configured; `SENTRY_AUTH_TOKEN` set in Vercel Build scope
**Addresses:** Error monitoring (table stakes feature); structured error context enriched with `userId`, `planTier`, `webhookEventId`
**Avoids:** Missing `onRequestError` RSC errors (Pitfall 1); broken source maps (Pitfall 2); PII leak via webhook context (Pitfall 3)
**Pitfall prevention:** Deploy to preview; throw intentionally in RSC; confirm readable TypeScript stack trace in Sentry before marking done
**Research flag:** Standard patterns — official wizard generates all files; skip research-phase

---

### Phase 3: PostHog Product Analytics

**Rationale:** Independent of email features. Install now so conversion and booking events are captured from the moment notification features launch in phases 6–7, rather than retrofitted after.
**Delivers:** `posthog-js` + `posthog-node` installed; `providers.tsx` PostHog client wrapper; `posthog-server.ts` singleton with serverless-safe config; event tracking on `booking_processed`, `trial_started`, `plan_upgraded`; `/ingest` proxy rewrite in `next.config.ts`
**Addresses:** Product analytics (P2 differentiator); Sentry + PostHog session correlation
**Avoids:** `PHProvider` forcing all pages client-rendered (Pitfall 4); server events lost in serverless (Pitfall 5)
**Pitfall prevention:** Keep `PHProvider` in a separate `'use client'` file; always call `await posthog.shutdown()` in server routes; test booking events appear in PostHog Live Events within seconds of a test webhook
**Research flag:** Standard patterns — skip research-phase

---

### Phase 4: Transactional Email Infrastructure

**Rationale:** Gating dependency for phases 5, 6, and 7. Build all templates as a unit so they can be iterated independently of trigger logic. Start Resend domain DNS verification at phase kickoff — not after implementation.
**Delivers:** `resend` + `react-email` + `@react-email/components` installed; `src/lib/email.ts` Resend singleton; five React Email templates (`BookingApproved`, `BookingRejected`, `TrialExpiry3Days`, `TrialExpiry1Day`, `TrialExpired`); Resend domain verified; `RESEND_API_KEY` + `EMAIL_FROM` env vars set
**Addresses:** Transactional email infrastructure (table stakes, gating feature)
**Avoids:** Resend domain not verified blocking testing (Pitfall 8); raw HTML template maintenance anti-feature
**Pitfall prevention:** Start DNS verification on day one; use Resend test mode during dev; propagate Resend API errors — never silently catch; verify by sending a test email to a real inbox (not just asserting API 200)
**Research flag:** Standard patterns — skip research-phase

---

### Phase 5: Email Preferences Schema + Settings UI

**Rationale:** Must be in place before any notification sends so preference checks are available. Schema migration and settings API are a small atomic unit that unblocks phases 6 and 7.
**Delivers:** Prisma migration adding `emailApprovedBookings`, `emailRejectedBookings`, `emailTrialWarnings` (all `@default(true)`) + `@@index([trialEndsAt])`; `/api/settings/email-preferences` GET + PATCH; settings page UI section with toggles and save confirmation toast
**Addresses:** User email notification preferences (P1 compliance requirement)
**Avoids:** No preference guard before sending (CAN-SPAM / GDPR exposure)
**Pitfall prevention:** Default all three flags to `true`; include "Manage notification settings" link in every email footer; show success toast after save (UX pitfall from PITFALLS.md)
**Research flag:** Standard patterns — skip research-phase

---

### Phase 6: Booking Notification Emails

**Rationale:** Modifies the production webhook hot path — the highest-risk code change in this milestone. Requires phases 4 and 5 to be stable. Wrap email sends in `try/catch`; email failure must never fail the webhook 200 response.
**Delivers:** Calendly webhook handler modified: structured logging (`logger.*`); conditional email sends for approved and rejected bookings (preference-gated); PostHog `booking_processed` event capture; "Add to allowlist" deep link (`?prefill=email@example.com`) in rejected booking emails
**Addresses:** Booking rejected notification (P1 core value); booking approved notification (P2); "Add to allowlist" CTA (P2 differentiator)
**Avoids:** Blocking webhook response on email send (ARCHITECTURE.md Anti-Pattern 1); PostHog events lost without `await shutdown()` (Pitfall 5)
**Pitfall prevention:** Email sends wrapped in `try/catch` — log failure but return 200 regardless; test both approved and rejected paths with real webhook payloads
**Research flag:** Standard patterns — skip research-phase

---

### Phase 7: Trial Expiry Cron + Warning Emails

**Rationale:** Last phase because it requires a `vercel.json` change (separate deployment artifact), a `CRON_SECRET` env var, and has the most complex idempotency requirements. Requires phases 4 and 5. Once-per-day frequency on Vercel Hobby plan is sufficient for 1-day and 3-day warning thresholds.
**Delivers:** `/api/cron/trial-expiry` route with `dynamic = 'force-dynamic'` + `runtime = 'nodejs'`; `vercel.json` crons entry at `0 9 * * *`; idempotent trial downgrade via `updateMany` with status guard; warning emails at 3-day and 1-day marks; expiry-day downgrade + email; Upstash Redis distributed lock re-using existing client; `CRON_SECRET` env var
**Addresses:** Trial expiration enforcement (P1 revenue integrity); trial expiry warning emails (P1 conversion)
**Avoids:** Static route generation (Pitfall 5); duplicate email sends on cron retry (Pitfall 6); cron endpoint exposed without auth (PITFALLS.md Security Mistakes); non-idempotent downgrade (ARCHITECTURE.md Anti-Pattern 6)
**Pitfall prevention:** Write-first, email-second order; `export const dynamic = 'force-dynamic'`; test cron endpoint directly with Bearer token in dev; verify two consecutive runs against same database state produce exactly one email + one DB change; verify `curl` without auth header returns 401
**Research flag:** Needs attention — complex idempotency logic; Vercel Hobby plan constraints; Redis distributed lock adds a sub-dependency; confirm `trialEndsAt` field exists in current User schema before planning

---

### Phase Ordering Rationale

- Logging before everything — makes all subsequent phases observable; eliminates `console.log` before new code is added
- Sentry before PostHog — error monitoring has higher operational priority; captures errors from all following phases
- PostHog before email — analytics should capture events from the moment notification features launch, not retrofitted later
- Email infrastructure before triggers — templates can be iterated and domain-verified independently before being wired to webhook logic
- Schema migration (phase 5) immediately after infrastructure — preferences must exist before any notification sends execute
- Booking notifications before cron — webhook hot path is synchronous and easier to test; establishes email-sending patterns before the more complex cron phase
- Trial cron last — most complex idempotency requirements; requires `vercel.json` deployment artifact; test thoroughly in preview before production

---

### Research Flags

Phases needing closer attention during planning:
- **Phase 7 (Trial Expiry Cron):** Idempotency logic is non-trivial; Vercel Hobby cron constraints; Redis distributed lock adds a sub-dependency. Confirm `trialEndsAt` field exists in User schema before phase kickoff. Review Vercel Cron docs and test with manual invocations before relying on scheduled execution.
- **Phase 6 (Booking Notifications):** Modifies the production hot path. Requires careful `try/catch` boundaries and thorough testing of both approved and rejected paths with real Calendly webhook payloads.

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1 (Structured Logging):** Pino is well-documented; `serverExternalPackages` config is a known Next.js pattern
- **Phase 2 (Sentry):** Official wizard generates all files; configuration is documented in official Sentry Next.js docs
- **Phase 3 (PostHog):** Official Next.js docs cover client/server split pattern completely
- **Phase 4 (Email Infrastructure):** Resend + React Email integration is straightforward; domain verification is the only time-sensitive step
- **Phase 5 (Schema + Settings):** Standard Prisma migration + CRUD API route

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions confirmed against npm registry; integration patterns verified against official docs; version compatibility matrix fully documented in STACK.md |
| Features | HIGH | Grounded in official Sentry/PostHog/Resend/Vercel docs; trial conversion patterns from multiple industry sources; competitor gap analysis from production SaaS examples |
| Architecture | HIGH | Component boundaries match existing codebase patterns; data flows are explicit; build order derived from dependency graph; all integration boundaries documented |
| Pitfalls | HIGH | 10 pitfalls verified against official docs and GitHub issues; warning signs, recovery strategies, and "looks done but isn't" checklist are concrete and actionable |

**Overall confidence: HIGH**

### Gaps to Address

- **Resend domain verification timing:** This is an infrastructure step with 24–48 hour DNS propagation — not a code task. It must be tracked as a prerequisite action to start at Phase 4 kickoff, not within implementation. If not started on time, it blocks all email testing.
- **`trialEndsAt` field existence:** The cron phase requires a `trialEndsAt` field on the User model. Confirm this field exists in the current schema before Phase 7 planning; it may require its own migration if not added in a prior milestone.
- **Vercel plan:** All cron frequency assumptions are based on Hobby plan (once/day max). If the project is on Vercel Pro, the `0 9 * * *` schedule is unchanged but the frequency constraint does not apply.
- **PostHog `shutdown()` hang risk:** Research flags a known issue where `await posthog.shutdown()` can hang in some edge runtime environments. Test in a preview deployment; add a `Promise.race` timeout wrapper if hang is observed.

---

## Sources

### Primary (HIGH confidence)

- `https://docs.sentry.io/platforms/javascript/guides/nextjs/` — Sentry Next.js instrumentation, `onRequestError`, `withSentryConfig`, source maps
- `https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/` — source map upload behavior, build vs runtime scope for `SENTRY_AUTH_TOKEN`
- `https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/` — `beforeSend` PII scrubbing configuration
- `https://posthog.com/docs/libraries/next-js` — client/server SDK split pattern, `flushAt`/`flushInterval` serverless requirement, `PHProvider` structure
- `https://posthog.com/docs/libraries/node` — posthog-node serverless configuration and `shutdown()` requirement
- `https://posthog.com/docs/privacy/gdpr-compliance` — session replay masking, PII capture controls
- `https://resend.com/docs/send-with-nextjs` — Resend Next.js integration, React Email usage
- `https://resend.com/pricing` — 3,000 emails/mo free tier confirmed
- `https://vercel.com/docs/cron-jobs` — `vercel.json` schema, `CRON_SECRET` pattern
- `https://vercel.com/docs/cron-jobs/usage-and-pricing` — Hobby plan once/day limit confirmed
- `https://vercel.com/docs/cron-jobs/manage-cron-jobs` — idempotency and concurrency handling
- npm registry — all 7 new package versions confirmed at research date
- `https://postmarkapp.com/guides/transactional-email-best-practices` — transactional email cadence patterns

### Secondary (MEDIUM confidence)

- `https://blog.arcjet.com/structured-logging-in-json-for-next-js/` — `serverExternalPackages` config for pino in Next.js 15
- `https://github.com/getsentry/sentry-javascript/discussions/13442` — `onRequestError` RSC coverage discussion
- `https://github.com/PostHog/posthog-js/issues/3130` — `posthog.shutdown()` hang in edge environments
- `https://github.com/vercel/next.js/discussions/46987` — pino Next.js App Router compatibility
- `https://github.com/vercel/next.js/discussions/67213` — pino Edge Runtime failure
- `https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs` — cron static generation bug
- `https://userlist.com/blog/trial-expiration-emails-saas/` — SaaS trial expiration email patterns and cadence standards
- WebSearch: Resend vs Postmark 2026 — Resend recommended for Next.js/React ecosystem

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*

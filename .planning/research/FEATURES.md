# Feature Research

**Domain:** SaaS production infrastructure — observability, structured logging, transactional email, trial lifecycle management, and user notification preferences for a Calendly booking protection app
**Researched:** 2026-03-21
**Confidence:** HIGH (grounded in official Sentry/PostHog docs, Postmark/Resend documentation, established SaaS trial conversion patterns, and Next.js 15 production deployment patterns)

---

## Context: What This Milestone Adds

Protectly already has: Calendly OAuth login, webhook-driven booking interception, allowlist CRUD, Stripe billing, security hardening (encryption, rate limiting, audit logging, 86 passing tests). The gap is production visibility and user communication. Currently: no error monitoring, no analytics, unstructured console.log/error, no email sending, no trial enforcement. This milestone fills all of those gaps.

**Constraint:** Stay within Next.js 15 / Prisma / PostgreSQL / Vercel + Railway. Use Resend or Postmark for email. Use Vercel Cron for scheduled tasks.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any production SaaS must have. Missing these means the product cannot be reliably operated or debugged in production.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Error monitoring (Sentry)** | Production errors are invisible without it. Support tickets arrive before engineers know there's a problem. Any SaaS charging money needs to know when things break. | LOW | Sentry has a Next.js wizard (`npx @sentry/wizard@latest -i nextjs`) that auto-configures `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`. Requires `@sentry/nextjs` v8.28+ for Next.js 15's `onRequestError` hook. Source maps must be enabled for readable stack traces — configure via `withSentryConfig` wrapper in `next.config.ts`. |
| **Source maps for production stack traces** | Minified stack traces pointing to line 1, column 99999 of `_app.js` are useless. Source maps are required for Sentry errors to be actionable. | LOW | Sentry's `withSentryConfig` handles source map upload automatically during build. Set `hideSourceMaps: true` to prevent public exposure. Keep source maps off of CDN but uploaded to Sentry only. |
| **Structured JSON logging** | `console.log('booking rejected')` is unsearchable in Vercel log aggregators, Railway logs, or Datadog. Structured logs with consistent field names make production debugging tractable. | LOW | Pino is the standard choice: 5x faster than Winston, JSON output by default, child loggers for request context, built-in data redaction. `next-logger` patches `console.*` to route through Pino automatically — minimal code change. Add `requestId`/correlation ID to all log entries. Never log tokens, PII, or session values. |
| **Trial expiration enforcement** | Trials on Protectly are currently un-enforced — users stay on PRO indefinitely. Any billing model with a trial period must enforce the cutoff or revenue leaks. | MEDIUM | Vercel Cron calling a protected API route (e.g., `/api/cron/expire-trials`). Cron runs daily. Query users where `trialEndsAt < now()` and `plan = 'TRIAL'`. Downgrade to `FREE`. Log the downgrade in audit log. Return 200 always (Vercel Cron retries on non-2xx). Secure with `CRON_SECRET` header check. |
| **Trial expiry warning emails** | Users who don't know their trial is expiring will churn unnecessarily. An email 3 days before and on expiry is the minimum expected behavior — every SaaS with trials does this. | MEDIUM | Trigger from cron job or a separate warning cron. Standard cadence: 3-day warning, 1-day warning (optional), expiry day. Email content: days remaining, what they'll lose, upgrade CTA. Requires transactional email infrastructure to be in place first. |
| **Transactional email infrastructure** | Without an email-sending capability, no notification features can be built. This is foundational — a prerequisite for all email notifications. | LOW | Choose Resend or Postmark (see Anti-Features for the "build your own" anti-feature). Both support React Email templates, have developer-friendly APIs, free tiers, and SOC 2 Type II compliance. Resend has better Next.js/React developer experience. Postmark has stronger deliverability reputation. Either works. Recommend Resend for DX. |
| **Booking approved/rejected email notifications** | Users need to know what happened to their bookings. A booking protection service that silently cancels meetings without notifying the user creates confusion and support tickets. "Why was this meeting cancelled?" is answerable by email. | MEDIUM | Two notification types: (1) approved — someone booked, they were on the allowlist; (2) rejected — someone booked, they were not on the allowlist, meeting was cancelled. Rejected email should include "Add [email] to your allowlist" action link (deep link to dashboard with pre-filled email). |

### Differentiators (Competitive Advantage)

Features that go beyond the baseline and create meaningful product differentiation or user trust.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **PostHog product analytics** | Turns guesswork into data. Understand which features drive retention, where users drop off, conversion from trial to paid. Critical for making roadmap decisions on a young SaaS product. | LOW | PostHog has a Next.js SDK with auto-capture. Key events to track: `user_signed_up`, `calendly_connected`, `booking_approved`, `booking_rejected`, `allowlist_entry_added`, `trial_started`, `plan_upgraded`, `trial_expired_downgraded`. Use server-side emission for revenue-critical events (upgrade, downgrade) to prevent client-side duplication. Attach `plan_tier` and `trial_days_remaining` to every event. |
| **"Add to allowlist" action in rejected booking emails** | Reduces friction for the core allow-listing workflow. Instead of navigating to the dashboard, finding the allowlist, and typing an email, the user clicks one link. Differentiates from generic notification emails. | LOW | Pre-signed URL (or a simple deep link with `?prefill=email@example.com`) that opens the dashboard with the rejected email pre-populated in the add-entry form. Requires session validation on click (user must be logged in). No cryptographic signing required — the email is not sensitive. |
| **User-controlled email notification preferences** | Reduces notification fatigue and respects user autonomy. Users who want to stay focused may not want an email for every approved booking (high-volume users). Users who primarily care about security may only want rejected-booking alerts. | MEDIUM | Settings UI section with toggles for: `emailOnApproved` (default: on), `emailOnRejected` (default: on). Store as boolean columns on the `User` model. Check preferences before sending in the notification dispatch logic. Default both to `true` to maximize initial engagement. |
| **Sentry + PostHog correlation** | Errors in Sentry can be linked to user sessions in PostHog. When an error occurs, the PostHog session replay shows exactly what the user was doing. Dramatically accelerates debugging. | LOW | Set PostHog's `session_id` as a Sentry tag. PostHog's Next.js SDK provides `posthog.get_session_id()`. Pass it to `Sentry.setTag('posthog_session_id', sessionId)` on initialization. |
| **Structured error context in Sentry** | Raw stack traces don't tell you which user, which booking, which allowlist entry was involved. Enriching Sentry errors with `userId`, `planTier`, `webhookEventId` turns "500 error in webhook handler" into "webhookEventId abc123 failed for user xyz on PRO plan." | LOW | Call `Sentry.setUser({ id: userId, plan: tier })` after session load. Add `Sentry.setExtra('webhookEventId', id)` in webhook handlers. Use Sentry's `withScope` for per-request context isolation. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Build custom email templates with raw HTML/CSS** | "We want full design control." Raw HTML email templates look professional and feel complete. | Email HTML is notoriously fragile across 40+ email clients. Custom inline-CSS responsive tables break constantly. Maintaining raw HTML email templates is a significant ongoing cost with no product value. | Use React Email (works with both Resend and Postmark). Write emails as React components, preview in browser, auto-inline CSS for email clients. Same developer experience as writing a UI component. |
| **Webhook-triggered emails with no rate limiting** | Send an email on every booking event seems natural — it mirrors the real-time nature of bookings. | High-volume users (100+ bookings/day) would receive a firehose of notifications and immediately unsubscribe or mark as spam. This damages sender reputation and deliverability for all users. | Honor user preferences (approved/rejected toggles). Add per-user email frequency limits (max N emails/hour per notification type). Consider digest batching for high-volume users in a future milestone. |
| **Custom SMTP server** | "We already have a mail server / we want to avoid vendor lock-in." | Custom SMTP requires DNS, SPF/DKIM/DMARC setup, IP warm-up, bounce handling, deliverability monitoring — each a full-time concern. A SaaS at this stage with custom SMTP is likely to have emails land in spam within weeks. | Use Resend or Postmark. Both are developer-focused, have excellent deliverability, free tiers, and handle all of SPF/DKIM/DMARC correctly. DNS setup takes 30 minutes, not weeks. |
| **Real-time in-app notifications (WebSockets/SSE)** | Looks impressive in demos. Users expect "modern" real-time feedback. | Adds significant architectural complexity (WebSocket server, connection state management, Vercel Edge limitations). Protectly is a background protection service — users are not watching the dashboard when bookings happen. Email is the right channel. | Email notifications for async events. Activity log on the dashboard for when users do visit. Real-time in-app notifications deferred to M3+ if demand emerges. |
| **Email open/click tracking pixels** | Marketers want to know if emails are being read. Standard email marketing feature. | Transactional emails are not marketing emails. Open tracking pixels are increasingly blocked (Apple Mail Privacy Protection blocks 90%+ of opens). Click tracking changes links to redirect URLs that break "Add to allowlist" deep links. GDPR/CCPA compliance for tracking pixels on transactional emails is murky. | Track meaningful actions instead: `allowlist_entry_added_from_email` PostHog event when the deep link CTA is used. This measures actual user value, not vanity open rates. |
| **SendGrid for transactional email** | Widely known, has a generous free tier, used by many tutorials. | SendGrid shares IP pools between transactional and marketing email unless explicitly configured. Marketing email activity on shared IPs degrades deliverability for transactional emails. Support is poor. The DX is dated compared to Resend. | Resend (DX-first, React Email native, modern API, reliable free tier) or Postmark (specialized transactional-only, strongest deliverability track record, separate "message streams" for transactional vs marketing). Either is substantially better than SendGrid for a developer-built transactional-only use case. |
| **PostHog session replay on all pages** | "Maximum visibility" — know exactly what users are doing. | Session replay captures all user interactions including potentially sensitive data (email addresses being typed, allowlist contents, booking details). PII in session replays creates GDPR compliance exposure. | Enable session replay only on onboarding and settings pages. Block capture on the allowlist management page and the activity log. Use PostHog's `capture_consent` and DOM element masking (`ph-no-capture` class) to prevent PII capture. |

---

## Feature Dependencies

```
[Transactional email infrastructure (Resend/Postmark + React Email)]
    └──required by──> [Booking approved notifications]
    └──required by──> [Booking rejected notifications]
    └──required by──> [Trial expiry warning emails (3-day, expiry-day)]
    └──required by──> [Post-expiry re-engagement email]

[User email notification preferences]
    └──required by──> [Booking approved notifications] (check preference before sending)
    └──required by──> [Booking rejected notifications] (check preference before sending)
    └──requires──> Prisma migration (add emailOnApproved, emailOnRejected boolean columns to User)

[Trial expiration cron job]
    └──required by──> [Trial expiry warning emails] (cron identifies who to warn)
    └──produces──> [Automated downgrade to FREE]
    └──produces──> [Audit log entry for downgrade]
    └──requires──> trialEndsAt field on User model (check if exists)
    └──requires──> Vercel Cron configuration (vercel.json crons entry)

[Trial expiry warning emails]
    └──requires──> [Transactional email infrastructure]
    └──requires──> [Trial expiration cron job] (or separate warning cron)

[Structured JSON logging (Pino)]
    └──independent (replaces console.log/error, no external dependencies)
    └──enhances──> [Sentry error context] (structured log fields feed Sentry breadcrumbs)

[Sentry error monitoring]
    └──independent (add to existing codebase, no feature dependencies)
    └──enhances with──> [Structured JSON logging] (correlation IDs appear in both)
    └──enhances with──> [PostHog analytics] (session ID correlation)

[PostHog product analytics]
    └──independent (add event tracking to existing flows)
    └──enhances with──> [Sentry] (session ID bridging)
    └──emits events from──> [Booking approved/rejected] (track outcomes)
    └──emits events from──> [Trial expiration] (track conversions/churn)

[Booking rejected notification + "Add to allowlist" CTA]
    └──requires──> [Transactional email infrastructure]
    └──produces event──> [PostHog: allowlist_entry_added_from_email] (if CTA used)
```

### Dependency Notes

- **Email infrastructure is the gating dependency:** Approved/rejected notifications and trial emails all require transactional email to exist first. Build this phase first.
- **Preferences must be checked before sending:** The notification preference columns must exist on `User` before any notification sending code executes. Schema migration must precede notification logic.
- **Trial cron and warning emails are decoupled:** Trial expiration enforcement (downgrade logic) can ship before warning emails. Downgrade is higher priority — prevents revenue leakage. Warnings are user experience improvement.
- **Sentry and PostHog are independent of email features:** Can be added in any order relative to email work. Recommend adding Sentry first since it immediately starts capturing errors from all the new code being written.
- **Pino logging is purely additive:** Replacing `console.log` with `logger.info` is a non-breaking change. Can be done incrementally or in one pass. No dependencies on any other feature.

---

## MVP Definition

### Must Ship (Core Production Readiness)

- [ ] **Sentry error monitoring** — production errors are currently invisible; first feature to add, immediately valuable
- [ ] **Structured JSON logging (Pino)** — required for production debugging; replaces console.log throughout
- [ ] **Transactional email infrastructure** — gating dependency for all notification features
- [ ] **Trial expiration enforcement (cron + downgrade)** — revenue integrity; users currently stay on PRO indefinitely after trial
- [ ] **Trial expiry warning emails (3-day, expiry-day)** — trial conversion directly correlates with timely warnings; last 3 days of trial = majority of conversions
- [ ] **Booking rejected email notification** — core value of the product; users need to know their protection is working
- [ ] **User email notification preferences** — required to avoid sending unwanted email; needed for CAN-SPAM / GDPR compliance on transactional notifications

### Add After Core (Enhances Value)

- [ ] **PostHog product analytics** — not blocking launch readiness but critical for product decisions; add after core infrastructure is stable
- [ ] **"Add to allowlist" CTA in rejected booking emails** — improves the booking rejection workflow; add alongside email notifications
- [ ] **Booking approved email notification** — less urgent than rejected (users care more about unexpected rejections than expected approvals); add with the same email infrastructure pass

### Future Consideration (v2+)

- [ ] **Email digest batching for high-volume users** — only relevant when users have 50+ bookings/day; not a current use case
- [ ] **In-app notification panel** — real-time feedback for active dashboard sessions; not the primary user interaction pattern for a background protection service
- [ ] **Sentry performance monitoring (tracing)** — start with error monitoring; add performance traces after baseline error visibility is established

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sentry error monitoring | HIGH (invisible production errors) | LOW (wizard + config) | P1 |
| Structured JSON logging | HIGH (production debuggability) | LOW (Pino + next-logger) | P1 |
| Transactional email infrastructure | HIGH (enables all email features) | LOW (Resend SDK + React Email) | P1 |
| Trial expiration enforcement | HIGH (revenue integrity) | MEDIUM (cron + Prisma query + downgrade) | P1 |
| Trial expiry warning emails | HIGH (trial-to-paid conversion) | MEDIUM (email templates + cron integration) | P1 |
| Booking rejected email notification | HIGH (core product value notification) | MEDIUM (email template + webhook integration) | P1 |
| User email notification preferences | HIGH (compliance + fatigue prevention) | MEDIUM (schema migration + settings UI) | P1 |
| Booking approved email notification | MEDIUM (confirmation, not primary concern) | LOW (reuses email infrastructure) | P2 |
| PostHog product analytics | HIGH (product decisions) | LOW (SDK + event tracking) | P2 |
| "Add to allowlist" CTA in rejected email | MEDIUM (UX improvement) | LOW (deep link + prefill param) | P2 |
| Sentry + PostHog session correlation | LOW (dev productivity, not user-facing) | LOW (one tag call) | P3 |
| Email open/click analytics | LOW (vanity metrics, blocked by clients) | — (anti-feature, do not build) | — |

**Priority key:**
- P1: Must have for this milestone — production readiness or revenue integrity
- P2: Should have — meaningful product improvement, low cost
- P3: Nice to have — developer productivity, future-oriented

---

## Competitor Feature Analysis

Comparable SaaS products: booking protection/scheduling tools (Reclaim.ai, Cal.com), and general SaaS production infrastructure patterns.

| Feature | Industry Standard | Protectly Current State | Gap |
|---------|-------------------|------------------------|-----|
| Error monitoring | All production SaaS use Sentry, Datadog, or equivalent | None | Critical gap |
| Structured logging | Expected for any production-deployed app | Unstructured console.log/error | Significant gap |
| Trial enforcement | Any SaaS with trials enforces the cutoff | Trials never expire (PRO indefinitely) | Critical gap — revenue leak |
| Trial expiry emails | 2-3 email cadence is universal | None | Significant gap |
| Booking notifications | Any protection/filter service notifies on action | None | Significant gap |
| Email preferences | Expected on any SaaS sending recurring email | None | Moderate gap |
| Product analytics | Data-driven SaaS teams use PostHog, Mixpanel, Amplitude | None | Significant gap |

---

## Sources

- [Sentry Next.js documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/) — HIGH confidence (official docs)
- [Sentry Manual Setup for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) — HIGH confidence (official docs)
- [PostHog event tracking guide](https://posthog.com/tutorials/event-tracking-guide) — HIGH confidence (official docs)
- [PostHog 5 events to track](https://posthog.com/blog/events-you-should-track-with-posthog) — HIGH confidence (official PostHog blog)
- [Postmark transactional email best practices 2026](https://postmarkapp.com/guides/transactional-email-best-practices) — HIGH confidence (official Postmark)
- [Pino logger Node.js guide](https://signoz.io/guides/pino-logger/) — MEDIUM confidence (third-party, corroborated by Pino's own docs)
- [SaaS trial expiration email patterns](https://userlist.com/blog/trial-expiration-emails-saas/) — MEDIUM confidence (industry analysis, multiple SaaS examples)
- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) — HIGH confidence (official Vercel docs)
- [PostHog vs Sentry comparison](https://posthog.com/blog/posthog-vs-sentry) — MEDIUM confidence (vendor-authored, corroborated by independent comparisons)
- SaaS trial conversion research: last 3 days = majority of conversions; 30/7/1 cadence as standard — MEDIUM confidence (multiple industry sources agree)

---

*Feature research for: SaaS production infrastructure (observability, logging, transactional email, trial management, email preferences)*
*Researched: 2026-03-21*

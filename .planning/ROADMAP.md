# Roadmap: Protectly

## Milestones

- ✅ **v0.1 Security Hardening & Cleanup** - Phases 1-6 (shipped 2026-02-23)
- 🚧 **v1.0 Core Infrastructure** - Phases 7-10 (in progress)

## Phases

<details>
<summary>✅ v0.1 Security Hardening & Cleanup (Phases 1-6) — SHIPPED 2026-02-23</summary>

### Phase 1: Foundation
**Goal**: The application validates its own configuration at startup and the encryption primitive is available for all downstream phases
**Depends on**: Nothing (first phase)
**Requirements**: ENV-01, ENV-02
**Success Criteria** (what must be TRUE):
  1. Starting the app without SESSION_SECRET causes an immediate boot failure with a clear error message — the app never reaches a request handler
  2. Starting the app without ENCRYPTION_KEY causes an immediate boot failure before any route handling
  3. Starting the app without CALENDLY_WEBHOOK_SIGNING_KEY causes an immediate boot failure — the env schema requires it unconditionally
  4. Starting the app with all required env vars present succeeds normally, and all lib modules reference the typed env object instead of raw process.env
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Install @t3-oss/env-nextjs, generate ENCRYPTION_KEY, create src/env.ts with full Zod schema
- [x] 01-02-PLAN.md — Create AES-256-GCM encryption primitive (src/lib/encryption.ts) via TDD
- [x] 01-03-PLAN.md — Update session.ts, stripe.ts, calendly.ts, and Calendly webhook route to use typed env; remove conditional bypass

### Phase 2: Token Security & Webhook Hardening
**Goal**: All Calendly OAuth tokens are encrypted at rest, all existing plaintext rows are migrated, and the webhook handler enforces tighter replay and timing-safe comparison rules
**Depends on**: Phase 1
**Requirements**: TOK-01, TOK-02, TOK-03, WHK-01, WHK-03
**Success Criteria** (what must be TRUE):
  1. All rows in the users table have calendlyAccessToken and calendlyRefreshToken values prefixed with enc:v1: — no plaintext tokens remain after migration
  2. A user who authenticates via Calendly OAuth can successfully make booking cancellations — the decrypt call in both calendlyRequest() and cancelBookingWithRetry() works transparently
  3. A webhook event with a timestamp older than 60 seconds is rejected — the tolerance is 60s, not 180s
  4. Allowlist email comparisons use crypto.timingSafeEqual on hashed values — the comparison does not short-circuit on first differing byte
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Encrypt token writes in OAuth callback; tighten webhook timestamp tolerance to 60s; timing-safe email comparison (TOK-01, WHK-01, WHK-03)
- [x] 02-02-PLAN.md — TDD: decrypt-on-read and encrypt-on-refresh in calendlyRequest() and cancelBookingWithRetry() (TOK-03)
- [x] 02-03-PLAN.md — Create and smoke-test one-time token migration script; human verification checkpoint (TOK-02)

### Phase 3: Rate Limiting
**Goal**: All API endpoints enforce sliding window rate limits via Upstash Redis middleware, with webhook paths excluded
**Depends on**: Phase 2
**Requirements**: ACL-01
**Success Criteria** (what must be TRUE):
  1. Sending more than 10 auth requests per minute from a single IP results in 429 responses on the 11th request
  2. Sending more than 30 allowlist write requests per minute from a single authenticated user results in 429 responses
  3. Sending requests to /api/webhooks/* paths does not trigger rate limiting — webhooks are excluded from the middleware matcher
  4. The application starts and handles requests locally without requiring Upstash credentials — dev environment degrades gracefully
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Install @upstash/ratelimit + @upstash/redis; add optional Upstash env vars to env.ts
- [x] 03-02-PLAN.md — Create middleware.ts with Node.js runtime, path-based limiters, graceful degradation, and Vitest tests

### Phase 4: Audit Logging & Webhook Idempotency
**Goal**: Every allowlist mutation is recorded in an immutable audit log, and duplicate Calendly and Stripe webhook events are silently skipped
**Depends on**: Phase 3
**Requirements**: ACL-02, WHK-02
**Success Criteria** (what must be TRUE):
  1. Adding an email to an allowlist creates an AuditLog record capturing userId, action (ADD), target email, and timestamp — visible via a direct database query
  2. Removing an email from an allowlist creates an AuditLog record with action REMOVE — the record persists even if subsequent operations fail
  3. Sending the same Calendly webhook event twice (same invitee URI) results in exactly one booking cancellation attempt — the second event is detected as a duplicate and skipped
  4. Sending the same Stripe event ID twice results in the subscription state being updated exactly once — duplicate events are idempotent
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Prisma schema migration (AuditLog + ProcessedWebhookEvent models) and audit logging in allowlist entry routes (ACL-02)
- [x] 04-02-PLAN.md — Webhook idempotency guards in Calendly and Stripe handlers via ProcessedWebhookEvent (WHK-02)

### Phase 5: Security Test Coverage
**Goal**: Vitest test suites cover all hardened security paths — webhook signature validation, Stripe lifecycle, allowlist permission enforcement, guest check modes, and token refresh — so that regressions are caught automatically
**Depends on**: Phase 4
**Requirements**: TST-01, TST-02, TST-03, TST-04, TST-05
**Success Criteria** (what must be TRUE):
  1. Running vitest covers webhook signature validation with at least 6 cases: valid signature, invalid key, missing header, tampered payload, 59-second timestamp (accepted), 61-second timestamp (rejected)
  2. Running vitest covers cross-user allowlist access: a request from user B to user A's allowlist endpoints returns 403 or 404 for GET, POST, and DELETE
  3. Running vitest covers all 15 guest check mode paths (5 modes x 3 scenarios: approved invitee, approved guest, unapproved guest) via an extracted pure function
  4. Running vitest covers Calendly token refresh: 401 triggers a refresh, retry with the new token succeeds, and a failed refresh is handled without crashing the handler
  5. Running vitest covers the Stripe subscription lifecycle: checkout completion, subscription deletion, invoice payment failure, and duplicate event idempotency
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Webhook signature validation tests (TST-01) + guest check mode extraction and 15-case test suite (TST-04)
- [x] 05-02-PLAN.md — Stripe subscription lifecycle tests (TST-02) + allowlist cross-user ACL tests (TST-03)
- [x] 05-03-PLAN.md — Calendly token refresh edge case tests (TST-05)

### Phase 6: Legacy Cleanup
**Goal**: The legacy Express application and all Sequelize artifacts are deleted, and the codebase uses a single HTTP client
**Depends on**: Phase 5
**Requirements**: CLN-01, CLN-02, CLN-03
**Success Criteria** (what must be TRUE):
  1. The files app.js, and the directories server/, views/, models/ no longer exist in the repository — git status shows them as deleted
  2. The files .sequelizerc, config/config.js, and the directories migrations/ and seeders/ no longer exist in the repository
  3. package.json and package-lock.json reference exactly one HTTP client library — there are no duplicate or unused fetch/HTTP packages
  4. The application builds (next build) and all Vitest tests pass after the deletions
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Remove legacy Express files (app.js, server/, views/, models/) and Sequelize artifacts (migrations/, seeders/, .sequelizerc, config/), clean .gitignore
- [x] 06-02-PLAN.md — Migrate calendly.ts from axios to native fetch, update test mocks, remove axios and node-fetch packages

</details>

### v1.0 Core Infrastructure (In Progress)

**Milestone Goal:** Make Protectly production-ready with error monitoring, product analytics, structured logging, transactional email notifications, and automated trial expiration handling.

#### Phase 7: Observability
**Goal**: Production errors are captured in Sentry, all server-side logging is structured JSON queryable in Vercel, and key product events are tracked in PostHog
**Depends on**: Phase 6
**Requirements**: OBS-01, OBS-02, OBS-03
**Success Criteria** (what must be TRUE):
  1. An error thrown in a Next.js Server Component appears in the Sentry dashboard within 60 seconds with a readable TypeScript stack trace — not minified code
  2. All server-side log output is valid JSON with request ID, user ID, and action fields — no raw console.log output remains in src/
  3. A booking webhook processed in production results in a booking_processed event visible in PostHog Live Events within seconds
  4. A Sentry error event does not contain raw Calendly webhook payload fields (invitee email, name) — beforeSend scrubbing is active
  5. Triggering a test error via a preview deployment returns a readable stack trace in Sentry pointing to the correct TypeScript file and line number
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Install pino + pino-pretty; create src/lib/logger.ts singleton with server-only guard; configure serverExternalPackages in next.config.ts; replace all console.log/error in src/ (OBS-03)
- [x] 07-02-PLAN.md — Run Sentry wizard; configure instrumentation files (server, client, edge); add withSentryConfig; configure beforeSend PII scrubbing; set SENTRY_AUTH_TOKEN in Vercel Build scope; add global-error.tsx (OBS-01)
- [x] 07-03-PLAN.md — Install posthog-js + posthog-node; create providers.tsx PHProvider; create src/lib/posthog-server.ts singleton with serverless-safe config; add /ingest proxy rewrite; track booking_processed, trial_started, plan_upgraded events (OBS-02)

#### Phase 8: Email Infrastructure & Preferences
**Goal**: Transactional email can be sent via Resend with React Email templates, and users can configure which notification emails they receive from their settings page
**Depends on**: Phase 7
**Requirements**: EMAIL-01, EMAIL-04
**Success Criteria** (what must be TRUE):
  1. Calling sendEmail() with a test template delivers a real email to the recipient's inbox — not just an API 200 response
  2. The Resend sending domain is verified and DNS-propagated — emails are not routed to spam
  3. A user can toggle approved and rejected booking email notifications from the settings page and the preference persists on reload
  4. A PATCH to /api/settings/email-preferences with invalid input returns a validation error — it does not silently fail or persist bad state
  5. All five email templates (BookingApproved, BookingRejected, TrialExpiry3Days, TrialExpiry1Day, TrialExpired) render without error and display correctly in a real email client
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Install resend + react-email + @react-email/components; create src/lib/email.ts Resend singleton; build all five React Email templates; set RESEND_API_KEY and EMAIL_FROM env vars (EMAIL-01)
- [x] 08-02-PLAN.md — Prisma migration adding emailApprovedBookings, emailRejectedBookings, emailTrialWarnings boolean columns (all default true) + @@index([trialEndsAt]); implement /api/settings/email-preferences GET + PATCH; add settings page UI toggles with save confirmation (EMAIL-04)

#### Phase 9: Booking Notification Emails
**Goal**: Users receive email notifications when bookings are approved or rejected, with a one-click "Add to allowlist" action on rejected booking emails
**Depends on**: Phase 8
**Requirements**: EMAIL-02, EMAIL-03
**Success Criteria** (what must be TRUE):
  1. When a booking is approved, the account owner receives a BookingApproved email containing the event details and a link to the activity log — only if their emailApprovedBookings preference is true
  2. When a booking is rejected, the account owner receives a BookingRejected email containing the invitee name, rejection reason, and an "Add to allowlist" link prefilled with the invitee email — only if their emailRejectedBookings preference is true
  3. A Calendly webhook that triggers an email send failure still returns HTTP 200 — email failure never blocks the webhook response
  4. A user with emailApprovedBookings set to false receives no email when a booking is approved
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md — Add preference-gated email sends for approved and rejected bookings to Calendly webhook handler with try/catch wrapping and tests (EMAIL-02, EMAIL-03)

#### Phase 10: Trial Lifecycle
**Goal**: Expired trials automatically downgrade users to the FREE tier daily, and users receive warning emails before their trial ends
**Depends on**: Phase 8
**Requirements**: TRIAL-01, TRIAL-02
**Success Criteria** (what must be TRUE):
  1. A user whose trial ended yesterday has their subscriptionStatus changed to FREE by the next cron run — verified by direct database query
  2. A user whose trial ends in 3 days receives a TrialExpiry3Days warning email on that day's cron run
  3. A user whose trial ends today receives a TrialExpiry1Day email and is downgraded to FREE in the same cron run — email is sent only after the database write succeeds
  4. Running the cron endpoint twice against the same database state produces exactly one downgrade and exactly one email per affected user — the operation is fully idempotent
  5. A GET request to /api/cron/trial-expiry without a valid CRON_SECRET bearer token returns 401
**Plans**: 1 plan

Plans:
- [ ] 10-01-PLAN.md — Create /api/cron/trial-expiry route with force-dynamic + nodejs runtime + CRON_SECRET bearer guard; implement idempotent trial downgrade via prisma.user.updateMany with status guard; write-first email-second order; add vercel.json cron entry at 0 9 * * * (TRIAL-01, TRIAL-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.1 | 3/3 | Complete | 2026-02-22 |
| 2. Token Security & Webhook Hardening | v0.1 | 3/3 | Complete | 2026-02-22 |
| 3. Rate Limiting | v0.1 | 2/2 | Complete | 2026-02-22 |
| 4. Audit Logging & Webhook Idempotency | v0.1 | 2/2 | Complete | 2026-02-22 |
| 5. Security Test Coverage | v0.1 | 3/3 | Complete | 2026-02-22 |
| 6. Legacy Cleanup | v0.1 | 2/2 | Complete | 2026-02-23 |
| 7. Observability | v1.0 | 3/3 | Complete   | 2026-03-21 |
| 8. Email Infrastructure & Preferences | v1.0 | 2/2 | Complete   | 2026-03-21 |
| 9. Booking Notification Emails | v1.0 | 1/1 | Complete   | 2026-03-21 |
| 10. Trial Lifecycle | v1.0 | 0/1 | Not started | - |

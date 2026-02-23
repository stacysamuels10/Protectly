# Roadmap: Protectly — Security Hardening & Cleanup

## Overview

This milestone hardens every security-sensitive path in Protectly before any new features are built. The work proceeds in dependency order: environment validation and encryption infrastructure first (everything else depends on these), then token encryption and webhook hardening, then rate limiting, then audit logging and idempotency, then a completeness sweep of security test coverage, and finally legacy code removal. Each phase delivers a verifiable, independently deployable hardening step. The codebase exits this milestone with encrypted tokens at rest, mandatory startup validation, rate-limited endpoints, an immutable audit trail, full security test coverage, and no legacy Express or Sequelize artifacts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Env validation at startup + encryption module available for use (completed 2026-02-22)
- [x] **Phase 2: Token Security & Webhook Hardening** - OAuth tokens encrypted at rest, existing rows migrated, webhook replay window tightened, timing-safe comparisons (completed 2026-02-22)
- [x] **Phase 3: Rate Limiting** - Sliding window rate limits enforced on all API endpoints via Upstash Redis middleware (completed 2026-02-22)
- [x] **Phase 4: Audit Logging & Webhook Idempotency** - Immutable audit trail for allowlist changes, duplicate event deduplication via idempotency keys (completed 2026-02-22)
- [x] **Phase 5: Security Test Coverage** - Comprehensive Vitest suites verifying all hardened paths (completed 2026-02-22)
- [ ] **Phase 6: Legacy Cleanup** - Express app, Sequelize artifacts, and redundant HTTP client removed

## Phase Details

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
- [ ] 01-01-PLAN.md — Install @t3-oss/env-nextjs, generate ENCRYPTION_KEY, create src/env.ts with full Zod schema
- [ ] 01-02-PLAN.md — Create AES-256-GCM encryption primitive (src/lib/encryption.ts) via TDD
- [ ] 01-03-PLAN.md — Update session.ts, stripe.ts, calendly.ts, and Calendly webhook route to use typed env; remove conditional bypass

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
- [ ] 02-02-PLAN.md — TDD: decrypt-on-read and encrypt-on-refresh in calendlyRequest() and cancelBookingWithRetry() (TOK-03)
- [ ] 02-03-PLAN.md — Create and smoke-test one-time token migration script; human verification checkpoint (TOK-02)

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
- [ ] 03-01-PLAN.md — Install @upstash/ratelimit + @upstash/redis; add optional Upstash env vars to env.ts
- [ ] 03-02-PLAN.md — Create middleware.ts with Node.js runtime, path-based limiters, graceful degradation, and Vitest tests

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
- [ ] 04-01-PLAN.md — Prisma schema migration (AuditLog + ProcessedWebhookEvent models) and audit logging in allowlist entry routes (ACL-02)
- [ ] 04-02-PLAN.md — Webhook idempotency guards in Calendly and Stripe handlers via ProcessedWebhookEvent (WHK-02)

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
- [ ] 05-01-PLAN.md — Webhook signature validation tests (TST-01) + guest check mode extraction and 15-case test suite (TST-04)
- [ ] 05-02-PLAN.md — Stripe subscription lifecycle tests (TST-02) + allowlist cross-user ACL tests (TST-03)
- [ ] 05-03-PLAN.md — Calendly token refresh edge case tests (TST-05)

### Phase 6: Legacy Cleanup
**Goal**: The legacy Express application and all Sequelize artifacts are deleted, and the codebase uses a single HTTP client
**Depends on**: Phase 5
**Requirements**: CLN-01, CLN-02, CLN-03
**Success Criteria** (what must be TRUE):
  1. The files app.js, and the directories server/, views/, models/ no longer exist in the repository — git status shows them as deleted
  2. The files .sequelizerc, config/config.js, and the directories migrations/ and seeders/ no longer exist in the repository
  3. package.json and package-lock.json reference exactly one HTTP client library — there are no duplicate or unused fetch/HTTP packages
  4. The application builds (next build) and all Vitest tests pass after the deletions
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-02-22 |
| 2. Token Security & Webhook Hardening | 3/3 | Complete    | 2026-02-22 |
| 3. Rate Limiting | 2/2 | Complete   | 2026-02-22 |
| 4. Audit Logging & Webhook Idempotency | 2/2 | Complete | 2026-02-22 |
| 5. Security Test Coverage | 3/3 | Complete | 2026-02-22 |
| 6. Legacy Cleanup | 0/TBD | Not started | - |

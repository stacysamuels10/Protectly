# Feature Research

**Domain:** SaaS security hardening — Next.js 15 app handling OAuth tokens, webhook processing, Stripe payments, and user allowlists
**Researched:** 2026-02-20
**Confidence:** HIGH (grounded in codebase audit + established security standards for OAuth 2.0, HMAC webhook verification, PCI/GDPR compliance patterns, and Stripe documentation patterns)

---

## Context: What This Is Hardening

Protectly (formerly PriCal) intercepts Calendly bookings via webhooks and cancels unauthorized ones based on user-managed allowlists. The security surface is:

1. **OAuth tokens** — Calendly access + refresh tokens stored plaintext in PostgreSQL
2. **Webhook ingestion** — HMAC-SHA256 signature verification exists but has a 3-minute replay window and no idempotency
3. **Stripe payments** — Webhook verification uses `stripe.webhooks.constructEvent()` correctly; subscription state sync has no idempotency guard
4. **Allowlist enforcement** — Email comparisons use Set membership (not timing-safe); no cross-user access tests; no rate limiting on CRUD endpoints
5. **Session security** — `iron-session` with `SESSION_SECRET` that has a weak fallback path; no env startup validation

The codebase already has correct patterns in some areas (HMAC timing-safe comparison in `webhook.ts`, `httpOnly`/`sameSite` cookies in `session.ts`, Stripe `constructEvent` signature check). The gaps are specific and fixable without architectural rewrites.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that production SaaS apps handling credentials and payments must have. Missing any of these = compliance failure, breach risk, or user trust loss.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **OAuth tokens encrypted at rest** | Database breach exposes user Calendly accounts. GDPR/CCPA treat OAuth tokens as personal data requiring protection. Any SaaS storing third-party OAuth credentials must encrypt them. | MEDIUM | AES-256-GCM at the application layer. Node.js `crypto` module provides this natively — no new dependencies needed. Encrypt on write, decrypt on read in `calendlyRequest()` and callback handler. Key from env (`ENCRYPTION_KEY`). Migration: encrypt existing rows. |
| **Startup environment variable validation** | App crashes at runtime on first request if `STRIPE_SECRET_KEY` or `SESSION_SECRET` is missing. Production SaaS must fail fast at startup with a clear error, not at runtime when serving traffic. | LOW | `zod` is already a dependency. Add `src/lib/env.ts` with `z.object({...}).parse(process.env)` called from a module imported at app startup. Next.js 15 supports `instrumentation.ts` for this pattern. |
| **Remove SESSION_SECRET weak fallback** | `process.env.SESSION_SECRET as string` with no fallback check means a missing env var produces an empty string session key in dev, making all sessions trivially forgeable. Iron-session silently accepts any string. | LOW | Remove the `as string` cast and add a runtime guard: `if (!process.env.SESSION_SECRET) throw new Error(...)`. Covered by env validation above if done correctly. |
| **Webhook timestamp tolerance tightened to 60 seconds** | The current 3-minute (180,000ms) window gives an attacker a wide replay window for intercepted webhook payloads. Both Stripe and Calendly documentation recommend 300 seconds maximum; 60 seconds is the practical standard. | LOW | Change default in `src/lib/webhook.ts` line 59: `toleranceMs: number = 60000`. Update tests. |
| **Webhook idempotency — deduplication via event key tracking** | Webhook providers (Stripe, Calendly) guarantee at-least-once delivery. Without idempotency tracking, duplicate events create duplicate `BookingAttempt` records and could trigger duplicate cancellation API calls. This is a data integrity issue, not just performance. | MEDIUM | Add `webhookEventId` (unique) column to `BookingAttempt`. For Calendly: use `payload.payload.uri` (invitee URI) as the idempotency key. For Stripe: use `event.id`. Check-before-insert with `findUnique`, return 200 on duplicate (Stripe/Calendly retry on non-2xx). |
| **Timing-safe email comparisons in allowlist checks** | Set membership (`allowedEmails.has(email)`) is not constant-time in all JS engine implementations. For a service where the timing of a `true`/`false` return determines whether a booking is cancelled, timing oracle attacks are theoretically possible. | LOW | Replace the `isEmailApproved` helper with `crypto.timingSafeEqual()` on normalized, fixed-length representations (e.g., SHA-256 hash of lowercased email). Pre-hash the allowlist on load. Note: the signature verification in `webhook.ts` already uses `timingSafeEqual` correctly — extend this pattern. |
| **Rate limiting on all API endpoints** | No endpoint has rate limiting. An attacker can enumerate allowlist contents via timing, flood the allowlist CRUD endpoints, or trigger expensive CSV imports repeatedly. For a paid SaaS, unprotected endpoints enable abuse and cost amplification. | MEDIUM | On Vercel: use `@upstash/ratelimit` with Redis (Upstash free tier works). On Railway: use an in-process sliding window (e.g., `lru-cache` based) or Upstash. Apply different limits per endpoint type: webhook endpoints (100/min by IP), allowlist write endpoints (30/min by user), auth endpoints (10/min by IP). |
| **Audit logging for allowlist changes** | Users need to know who changed their allowlist and when — especially for compliance investigations and support tickets. No current audit trail exists. `BookingAttempt` records who was blocked but not who made allowlist changes. | MEDIUM | Add `AuditLog` model to Prisma schema with fields: `userId`, `action` (enum: `ENTRY_ADDED`, `ENTRY_REMOVED`, `ENTRY_BULK_IMPORTED`, `ALLOWLIST_CLEARED`), `targetEmail`, `metadata` (JSONB), `createdAt`. Write log entries in allowlist CRUD handlers. No new dependencies. |
| **Test coverage: webhook signature validation** | Security-critical paths with zero tests are effectively untested in production. Signature bypass, missing headers, tampered payloads, and timestamp boundary conditions are exactly the attack vectors a webhook endpoint faces. | MEDIUM | Vitest unit tests for `verifyWebhookSignature` and `isTimestampValid` covering: valid signature passes, invalid key fails, missing header fails, tampered payload fails, timestamp at boundary (59s/61s), expired timestamp fails. |
| **Test coverage: Stripe subscription lifecycle** | Failed payments, cancellations, and downgrades directly affect access control. A bug here means users retain access after cancellation or lose access incorrectly. | MEDIUM | Vitest tests for Stripe webhook handler covering: `checkout.session.completed` sets correct tier, `customer.subscription.deleted` downgrades to FREE, `invoice.payment_failed` sets PAST_DUE, duplicate event is idempotent. |
| **Test coverage: allowlist cross-user access enforcement** | The CRUD handler checks `userId` but has no tests. A missing or incorrect check would allow user A to read/modify user B's allowlist. | HIGH | Vitest tests for `GET/POST/DELETE /api/allowlists/[id]/entries` that pass a `userId` from a different user and assert 403/404. |
| **Test coverage: guest check mode combinations** | 5 modes × 3 invitee/guest scenarios = 15 paths through the core business logic. Currently untested. A logic bug here is the primary product failure mode. | MEDIUM | Vitest unit tests extracting the `switch(user.guestCheckMode)` block into a pure function, then testing all 15 combinations with explicit assertions. |

### Differentiators (Competitive Advantage)

Features that aren't expected at baseline but add genuine value. For a security-hardening milestone, differentiators are about trust signals and operational resilience, not new features.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Audit log UI for allowlist history** | Users can see "who added X email and when" — valuable for teams using Protectly for meeting compliance. Turns a backend table into a user-visible trust signal. | LOW | Read-only table on the dashboard pulling from `AuditLog`. Requires audit logging (table stakes) to be built first. |
| **Centralized token manager with race condition protection** | The current `calendlyRequest()` wrapper and `cancelBookingWithRetry()` duplicate token refresh logic and have a race condition: concurrent requests during a refresh can both try to refresh, with the second succeeding using the old refresh token (now invalidated). A centralized manager with a mutex eliminates this. | HIGH | Use `async-mutex` package or a database-level advisory lock. Token refresh atomicity matters when users have high booking volume. This is a reliability improvement that reduces "Calendly disconnected" support tickets. Not needed for initial hardening but valuable soon after. |
| **Idempotency keys surfaced in activity log** | When a webhook fires twice (Calendly retries), showing "duplicate event detected, skipped" in the activity log instead of two identical records gives users visibility into webhook reliability. | LOW | Requires idempotency tracking (table stakes) to be built first. Add a `isDuplicate` flag to `BookingAttempt`. |
| **Structured security event logging** | Instead of `console.error()` for signature failures, emit structured JSON logs with `eventType`, `severity`, `ip`, `timestamp` — compatible with log aggregation (Datadog, Logtail, etc.). Makes anomaly detection possible. | LOW | Replace `console.error('[Calendly Webhook] Invalid webhook signature')` with a structured logger utility. No new infrastructure required; the log aggregation is the user's choice. |
| **OAuth state parameter CSRF protection** | The current `getCalendlyAuthUrl(state: string)` accepts an externally-provided state string. Verify the state on callback against a server-side value (stored in session or signed cookie) to prevent CSRF on the OAuth flow. | LOW | Generate `state` server-side as a cryptographically random value, store in session, verify on callback. Standard OAuth 2.0 CSRF protection. Currently missing from `src/app/api/auth/calendly/route.ts`. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Redis-backed session store** | Horizontal scaling requires shared session state; multiple Vercel instances lose sessions. | This milestone is hardening, not scaling. Current single-instance deployment doesn't need Redis. Adding Redis introduces a new infrastructure dependency and operational cost before it's needed. CONCERNS.md already flags this as a scaling concern for later. | Keep iron-session with encrypted cookies (stateless by design — the session IS the cookie). Iron-session v8 already does this correctly. The "scaling" concern is moot because cookie sessions are inherently stateless. No server-side session store needed at all. |
| **Full database encryption at rest (PostgreSQL TDE)** | Compliance checklists mention "encryption at rest." Seems like the right solution to token storage risk. | PostgreSQL Transparent Data Encryption is a database-level feature that encrypts files on disk. It does NOT protect against a compromised application layer or a database superuser reading token values in plaintext. It also requires database-level configuration not available on Railway's managed Postgres. | Application-layer field encryption for the specific sensitive fields (`calendlyAccessToken`, `calendlyRefreshToken`). This protects against database read access (e.g., backup theft, SQL injection into a read-only role) while remaining stack-compatible. |
| **mTLS / client certificate verification on webhook endpoints** | Advanced webhook security recommendation sometimes seen in enterprise contexts. | Calendly and Stripe don't support sending client certificates. Adding mTLS would break webhook delivery entirely. | HMAC signature verification (already implemented for both providers) is the correct, provider-supported mechanism. Tighten the timestamp window and add idempotency instead. |
| **Custom rate limiting algorithm (token bucket, leaky bucket from scratch)** | Control over rate limiting behavior for edge cases. | Writing a production-grade, distributed, in-memory rate limiter is a significant engineering project with subtle failure modes (thundering herd, memory leaks, cold start issues). | Use Upstash Rate Limit (`@upstash/ratelimit`) for Vercel deployments or a well-tested library (`rate-limiter-flexible`) for Railway. Both are battle-tested and integrate in under 50 lines. |
| **Argon2/bcrypt hashing of stored OAuth tokens** | "Tokens should be hashed like passwords" sounds like a security improvement. | OAuth tokens must be retrieved in plaintext to be used in API calls (`Authorization: Bearer <token>`). Hashing is one-way and irreversible — the app would never be able to call the Calendly API again. Bcrypt/Argon2 are for verifying secrets, not for protecting retrievable credentials. | Reversible AES-256-GCM encryption at the application layer. The encryption key is in the environment, not the database. Compromise of the database alone is insufficient to recover the tokens. |
| **Admin dashboard for user management** | Support team visibility into user state for debugging. | Explicitly out of scope per PROJECT.md — deferred to next milestone. Building admin tooling before security hardening is complete inverts priorities. | Fix the audit log first so support investigations can be done by querying the `AuditLog` table directly. Admin UI is the next milestone. |

---

## Feature Dependencies

```
[Startup env validation]
    └──enables──> [Remove SESSION_SECRET fallback]  (validation catches the missing var)
    └──enables──> [OAuth token encryption] (ENCRYPTION_KEY validated at startup)

[OAuth token encryption]
    └──requires──> [Startup env validation]  (ENCRYPTION_KEY must be validated before use)
    └──affects──> [Test coverage: token refresh]  (tests must use encrypted tokens)

[Webhook idempotency]
    └──requires──> Prisma migration (new webhookEventId column on BookingAttempt)
    └──enables──> [Idempotency keys surfaced in activity log] (differentiator)
    └──affects──> [Test coverage: Stripe lifecycle] (tests must assert idempotency)

[Audit logging]
    └──requires──> Prisma migration (new AuditLog model)
    └──enables──> [Audit log UI] (differentiator)
    └──affects──> [Test coverage: allowlist cross-user access] (log entries verifiable in tests)

[Rate limiting]
    └──requires──> Infrastructure decision (Upstash for Vercel, in-process for Railway)
    └──independent of other security features (can be added in any order)

[Timing-safe email comparisons]
    └──independent (pure logic change, no dependencies)

[Webhook timestamp tolerance tightened]
    └──independent (single constant change + test update)

[Test coverage: webhook signature]
    └──independent of other features (tests existing code)

[Test coverage: guest check mode]
    └──enhances──> [Guest check mode logic refactor] (extract pure function first, then test)
    └──independent of security features

[Test coverage: cross-user access]
    └──enhances with──> [Audit logging] (can assert log entries in same test)

[OAuth CSRF state protection] (differentiator)
    └──requires──> [Startup env validation] (session must be reliable before OAuth state stored in it)
```

### Dependency Notes

- **Startup env validation enables everything else:** ENCRYPTION_KEY for token encryption and SESSION_SECRET hardening both depend on env validation running before any request handler fires. Build this first.
- **Prisma migrations block two features:** Token encryption requires a schema migration (no column change, but a data migration for existing rows). Idempotency and audit logging each require new columns/models. These migrations can run in one pass if sequenced together.
- **Rate limiting is deliberately decoupled:** It has no dependencies on other security features and can be merged independently. Doing it last avoids rate-limit interference during integration testing of other features.
- **Guest check mode testing benefits from refactoring first:** The `switch(user.guestCheckMode)` block in `calendly/route.ts` is currently embedded in a 355-line route handler. Extracting it to a pure function (`determineBookingApproval(mode, inviteeApproved, guests)`) makes it trivially testable without mocking Prisma or HTTP. Do the extraction as part of the test implementation.

---

## MVP Definition

This is a hardening milestone, not a greenfield project. The "MVP" framing maps to: what is the minimum required to consider the app safe to operate at production scale with paying customers?

### Must Ship (Security-Critical)

- [x] **Startup env validation** — prevents silent misconfiguration failures that are invisible until a request hits a broken path
- [x] **Remove SESSION_SECRET fallback** — eliminates the most direct session forgery risk
- [x] **OAuth tokens encrypted at rest** — database exposure currently = full Calendly account takeover for every user
- [x] **Webhook timestamp tolerance tightened** — single-line fix with outsized replay protection improvement
- [x] **Webhook idempotency** — prevents duplicate cancellations and data integrity issues from Calendly/Stripe retries
- [x] **Audit logging** — without this, a security incident cannot be investigated
- [x] **Test: webhook signature** — untested security-critical code is effectively unverified code
- [x] **Test: cross-user access** — the most direct authorization vulnerability to verify

### Add After Core Security (Operational)

- [ ] **Rate limiting** — important but not an immediate breach risk; add after core security features are stable
- [ ] **Timing-safe email comparisons** — the existing Set-based check is resistant in practice; the theoretical timing oracle is lower priority than the confirmed plaintext token storage
- [ ] **Test: Stripe subscription lifecycle** — important for payment integrity; add when idempotency is in place
- [ ] **Test: guest check mode combinations** — important for product correctness; add with the logic extraction refactor

### Defer to Next Milestone

- [ ] **Centralized token manager with mutex** — eliminates a race condition that requires concurrent high-volume booking to trigger; address when performance work begins
- [ ] **Audit log UI** — requires the backend audit log first; UI is a next milestone feature
- [ ] **OAuth CSRF state protection** — low exploitation risk in current auth flow; address as part of auth hardening pass
- [ ] **Structured security event logging** — valuable for production observability but not a breach risk; address when logging infrastructure is chosen

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Startup env validation | HIGH (prevents silent failures) | LOW (zod + instrumentation.ts) | P1 |
| Remove SESSION_SECRET fallback | HIGH (eliminates session forgery risk) | LOW (3-line fix) | P1 |
| OAuth tokens encrypted at rest | HIGH (plaintext tokens = breach) | MEDIUM (crypto + migration) | P1 |
| Webhook timestamp tolerance tightened | HIGH (replay attack window) | LOW (constant change) | P1 |
| Webhook idempotency | HIGH (data integrity + duplicate cancels) | MEDIUM (migration + check-before-insert) | P1 |
| Audit logging | HIGH (compliance + incident investigation) | MEDIUM (new model + write calls) | P1 |
| Test: webhook signature | HIGH (security regression prevention) | MEDIUM (15+ test cases) | P1 |
| Test: cross-user access | HIGH (authorization verification) | MEDIUM (mock setup + assertions) | P1 |
| Rate limiting | HIGH (abuse prevention) | MEDIUM (Upstash integration) | P2 |
| Timing-safe email comparisons | MEDIUM (theoretical risk) | LOW (hash-based comparison) | P2 |
| Test: Stripe lifecycle | HIGH (payment integrity) | MEDIUM (mock Stripe events) | P2 |
| Test: guest check mode | HIGH (core logic correctness) | LOW (after extraction refactor) | P2 |
| OAuth CSRF state protection | MEDIUM (OAuth security hardening) | LOW (session state + verify) | P2 |
| Centralized token manager | MEDIUM (race condition elimination) | HIGH (mutex + refactor) | P3 |
| Audit log UI | MEDIUM (user visibility) | LOW (read-only table) | P3 |
| Structured security logging | LOW (observability) | LOW (logger utility) | P3 |

**Priority key:**
- P1: Must have for this milestone — security failure risk
- P2: Should have — operational resilience and test coverage
- P3: Nice to have — defer to next milestone

---

## Competitor Feature Analysis

The relevant comparators are other Calendly-adjacent SaaS tools (e.g., Reclaim.ai, Calendly itself, Cal.com) and security-hardened Next.js SaaS templates (e.g., Vercel's commerce template, next-saas-starter). The security baseline expected by 2026:

| Feature | Industry Baseline | Protectly Current State | Gap |
|---------|-------------------|------------------------|-----|
| Credentials encrypted at rest | Expected for any SaaS storing third-party tokens | Plaintext in PostgreSQL | CRITICAL gap |
| Webhook replay protection | 5-minute window is common; 60 seconds is recommended | 3-minute window | Moderate gap |
| Webhook idempotency | Expected for any webhook-driven SaaS | Not implemented | Significant gap |
| Rate limiting | Expected on all write endpoints | None | Significant gap |
| Audit logging | Expected for any allowlist/access-control SaaS | None | Significant gap |
| Env validation at startup | Expected in production-grade Next.js | None | Moderate gap |
| Session security (httpOnly, sameSite) | Standard | Implemented correctly | No gap |
| HMAC webhook signature verification | Required | Implemented correctly | No gap |
| Stripe signature verification | Required | Implemented correctly (constructEvent) | No gap |
| Test coverage on security paths | Expected | Zero coverage on critical paths | Significant gap |

---

## Sources

- Codebase audit: `.planning/codebase/CONCERNS.md` (2026-02-20) — HIGH confidence, primary source
- Codebase direct inspection: `src/lib/webhook.ts`, `src/lib/session.ts`, `src/lib/stripe.ts`, `src/lib/calendly.ts`, `prisma/schema.prisma`, `src/app/api/webhooks/` — HIGH confidence
- OAuth 2.0 Security Best Current Practice (RFC 9700, 2025) — CSRF state parameter requirement is long-established; HIGH confidence from training data corroborated by IETF published standards
- OWASP Top 10 (2021, still current as of 2025) — A02 Cryptographic Failures (plaintext tokens), A07 Identification/Authentication (session secrets), A05 Security Misconfiguration (env vars) — HIGH confidence
- Stripe webhook documentation patterns — `stripe.webhooks.constructEvent()` already in use; idempotency via `event.id` is Stripe's documented recommendation — HIGH confidence from existing codebase + Stripe SDK usage
- Calendly webhook documentation patterns — HMAC-SHA256 with `t=` timestamp in header already correctly implemented; 60-second tolerance is industry standard — MEDIUM confidence (training data; Stripe docs accessible as reference model)
- AES-256-GCM for application-layer field encryption — Node.js `crypto.createCipheriv('aes-256-gcm', ...)` is the current NIST-recommended symmetric encryption for this pattern — HIGH confidence
- Upstash Rate Limit — documented integration with Next.js 15 Edge Runtime and Vercel; `@upstash/ratelimit` is the standard recommendation for Vercel-deployed Next.js apps as of 2025 — MEDIUM confidence (training data; verify current API before implementation)

---

*Feature research for: SaaS security hardening (OAuth tokens, webhook processing, Stripe payments, allowlist enforcement)*
*Researched: 2026-02-20*

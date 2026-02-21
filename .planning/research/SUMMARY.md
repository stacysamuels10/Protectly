# Project Research Summary

**Project:** Protectly — Security Hardening Milestone
**Domain:** SaaS security retrofit — Next.js 15 / Prisma / PostgreSQL app handling OAuth tokens, Calendly webhooks, Stripe payments, and user allowlists
**Researched:** 2026-02-20
**Confidence:** HIGH (grounded in codebase inspection + established security standards; all findings traceable to specific files or NIST/OWASP standards)

## Executive Summary

Protectly is a Calendly booking gate — it intercepts webhook events and cancels unauthorized bookings based on user-managed allowlists. The product is architecturally sound: the existing implementation correctly uses HMAC-SHA256 for webhook signature verification, httpOnly/sameSite cookies for sessions, and Stripe's `constructEvent()` for payment webhook verification. The security hardening milestone is not a rewrite — it is a targeted retrofit of five specific gaps that represent real breach risk at the current production scale: plaintext OAuth token storage, optional (not mandatory) webhook signature enforcement, missing rate limiting, no audit trail, and absent startup environment validation.

The recommended approach concentrates all new work into the existing stack with minimal new dependencies. Node.js's built-in `crypto` module handles AES-256-GCM field encryption (no new packages). Zod, already installed at 3.25.76, handles startup env validation (via `@t3-oss/env-nextjs` as a thin wrapper). `@upstash/ratelimit` + `@upstash/redis` provides Vercel-compatible distributed rate limiting — the only architectural requirement that cannot be satisfied with existing tooling. Audit logging is a new Prisma model writing to PostgreSQL, queryable by the application with no external service. The existing Vitest and Playwright tooling is sufficient for all security test suites — the gap is coverage, not capability.

The critical risk in this milestone is sequence and completeness, not technical difficulty. The encryption pitfall that kills implementations is deploying the encrypt/decrypt code without a data migration for existing rows — every user who does not re-authenticate ends up with a permanently unreadable token. The second-order risk is the duplicated token refresh logic in two separate code paths (`calendlyRequest()` and `cancelBookingWithRetry()`), which means adding decryption in one place without the other produces silent 401 failures for booking cancellations. Both risks are preventable by following the build order: consolidate token access first, then encrypt, then validate with tests that cover both code paths.

---

## Key Findings

### Recommended Stack

The hardening requires adding exactly two new npm packages and extending three existing ones. Node.js's `crypto` module (already imported in `src/lib/webhook.ts`) handles all encryption operations — AES-256-GCM with per-call random IVs, 96-bit for GCM, stored as a versioned envelope (`enc:v1:<iv>:<authTag>:<ciphertext>`). Zod (3.25.76, already installed) via `@t3-oss/env-nextjs` provides startup env validation with Next.js-aware client/server variable split — validates at both build time and runtime so missing secrets fail at boot rather than mid-request. Rate limiting requires `@upstash/ratelimit` + `@upstash/redis` because Vercel serverless functions have no shared in-process memory; in-memory rate limiters silently reset on every cold start and provide zero protection in production.

**Core technologies:**
- `crypto` (Node.js built-in): AES-256-GCM field encryption for OAuth tokens — no new dependency, already imported in the project
- `@t3-oss/env-nextjs` (~0.10.x): Startup env validation wrapping existing Zod — catches missing secrets at boot rather than at first request
- `zod` (3.25.76, installed): Schema validation for env vars — already a dependency, acts as peer dep for `@t3-oss/env-nextjs`
- `@upstash/ratelimit` (~2.x): Sliding window rate limiting via HTTP Redis — required for Vercel's stateless serverless model
- `@upstash/redis` (~1.x): HTTP Redis client for Upstash — pairs exclusively with `@upstash/ratelimit`
- Prisma `AuditLog` model (existing Prisma 5.7.1): Database-native audit trail — queryable by the app, no external service, survives deployments
- Vitest (4.0.16, installed): Security unit test suites — existing tooling is sufficient; coverage is the gap, not the tool

New environment variables required: `ENCRYPTION_KEY` (32 bytes as 64-char hex), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. The existing `SESSION_SECRET` must be verified to be set (not just cast) in all environments.

See `.planning/research/STACK.md` for full alternatives analysis and installation commands.

---

### Expected Features

The feature research distinguishes three tiers: must-ship for this milestone (security failures), add-after-core (operational resilience), and defer to next milestone (new product surface area). The research is explicitly grounded in codebase gaps, not aspirational features.

**Must have (P1 — security-critical):**
- OAuth tokens encrypted at rest — plaintext Calendly tokens in PostgreSQL are a database-breach-level risk for every user
- Startup environment variable validation — eliminates silent misconfiguration that crashes mid-request rather than at boot
- SESSION_SECRET weak fallback removal — eliminates session forgery risk from missing env var in dev-like environments
- Webhook timestamp tolerance tightened to 60 seconds (from 3 minutes) — single constant change, substantial replay protection improvement
- Webhook idempotency via deduplication key — prevents duplicate cancellations and data integrity issues from Calendly/Stripe at-least-once delivery
- Audit logging for allowlist changes — without this, security incidents cannot be investigated
- Test: webhook signature validation (15+ cases) — untested security-critical code is unverified code
- Test: cross-user access enforcement — most direct authorization vulnerability; must be verified with tests

**Should have (P2 — operational resilience):**
- Rate limiting on all API endpoints (excluding webhook paths) — abuse prevention and cost amplification protection
- Timing-safe email comparisons using `crypto.timingSafeEqual` — extends existing pattern from webhook.ts to allowlist checks
- Test: Stripe subscription lifecycle (failed payments, cancellations, downgrades)
- Test: guest check mode combinations (5 modes x 3 guest scenarios = 15 paths through core logic)
- OAuth state parameter CSRF protection — standard OAuth 2.0 requirement, currently missing from auth callback

**Defer to next milestone (P3):**
- Centralized token manager with mutex — eliminates race condition that requires concurrent high-volume booking to trigger
- Audit log UI — requires the backend audit log (P1) to be built first; UI is next milestone
- Structured security event logging (JSON structured logs for log aggregation)

**Anti-features confirmed by research (do not build):**
- Redis-backed session store — iron-session's encrypted cookies are inherently stateless; no shared session store is needed
- PostgreSQL TDE (Transparent Data Encryption) — database-level; does not protect against a compromised application layer or Railway's managed Postgres constraints
- mTLS on webhook endpoints — Calendly and Stripe don't support client certificates; HMAC signature verification is the correct gate
- Bcrypt/Argon2 for token "encryption" — one-way hashing; tokens cannot be recovered for API use

See `.planning/research/FEATURES.md` for the full prioritization matrix and dependency graph.

---

### Architecture Approach

The security hardening adds three cross-cutting layers to the existing five-layer architecture without requiring any structural rewrite. The new layers hook into specific, well-defined seams: `src/lib/env.ts` runs at module load time before any request handler fires; `middleware.ts` intercepts all `/api/*` requests except `/api/webhooks/*` before they reach route handlers; and Prisma's `$use` middleware intercepts allowlist mutations to write `AuditLog` records using `AsyncLocalStorage` for actor context. Token encryption is explicitly two call sites for writes (OAuth callback) and two call sites for reads (`calendlyRequest()` and `cancelBookingWithRetry()`) — not transparent ORM-level encryption, which adds invisible complexity.

**Major components:**
1. Env Validation (`src/lib/env.ts`) — Zod schema parses and validates all required env vars at module load time; exports typed `env` object consumed by all lib modules instead of raw `process.env`
2. Encryption Module (`src/lib/encryption.ts`) — pure AES-256-GCM encrypt/decrypt with no Prisma dependency; called explicitly at the two write sites and two read sites for OAuth tokens
3. Rate Limiting Middleware (`middleware.ts`) — sliding window via Upstash Redis; matcher excludes `/api/webhooks/*`; different limits per endpoint class (auth: 10/min, allowlist writes: 30/min, reads: 120/min)
4. AuditLog Model + Prisma Middleware (`prisma/schema.prisma` + `src/lib/prisma.ts`) — immutable audit records written fire-and-forget via `$use` middleware; actor identity passed via `AsyncLocalStorage`
5. Idempotency Keys (`BookingAttempt` schema) — `@unique` constraint on `calendlyEventUri` and new `stripeEventId` column prevents duplicate event processing

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, integration points, and anti-pattern analysis.

---

### Critical Pitfalls

1. **Encrypting new tokens without migrating existing plaintext rows** — Deploying encryption code without a data migration leaves all existing users with plaintext tokens indefinitely (Calendly tokens are long-lived; users don't re-auth often). Prevention: write the migration script first, gate it with `DRY_RUN`, verify with `SELECT COUNT(*) FROM users WHERE "calendlyAccessToken" NOT LIKE 'enc:v1:%'` = 0 after deploy.

2. **Missing decrypt call in `cancelBookingWithRetry`** — Token refresh logic exists in two places: `calendlyRequest()` in `src/lib/calendly.ts` and `cancelBookingWithRetry()` in the webhook route handler. Adding decryption to only one produces silent 401 failures for booking cancellations — the webhook handler returns `received: true` regardless, so the bug is invisible. Prevention: consolidate token access behind a single function before adding any encryption.

3. **In-memory rate limiting on Vercel serverless** — A module-level `Map` rate counter resets on every cold start; each serverless invocation may be a fresh process. Prevention: use Upstash Redis (`@upstash/ratelimit`) for all production rate limiting; never use in-process state for rate counters in a serverless environment.

4. **Webhook signature verification made optional by a missing env var** — The current handler has `if (webhookSigningKey) { verify() }`. If `CALENDLY_WEBHOOK_SIGNING_KEY` is absent from a production environment, all webhooks are accepted without verification. Prevention: add `CALENDLY_WEBHOOK_SIGNING_KEY` to the Zod env schema as required; remove the conditional guard entirely.

5. **Session invalidation cascade when removing SESSION_SECRET fallback** — Changing the iron-session `password` value invalidates all existing user sessions simultaneously. Prevention: verify `SESSION_SECRET` is consistently set in Railway production, Railway staging, and all Vercel environments before deploying the code change; plan the deployment for a low-traffic window.

6. **Audit log write breaking business operations** — Placing `prisma.auditLog.create()` inside an existing database transaction causes the whole transaction to roll back on audit failure. Prevention: use fire-and-forget pattern (`void create().catch(console.error)`) for audit writes that must not block the primary operation; use `$transaction` only where atomic consistency is required.

See `.planning/research/PITFALLS.md` for the full 8-pitfall analysis with recovery strategies and phase-to-pitfall mapping.

---

## Implications for Roadmap

Based on research, the architecture's dependency graph directly dictates phase order. The build order is not arbitrary — each phase's output is a prerequisite for the next. Five phases emerge from the combined research.

### Phase 1: Foundation — Env Validation + Encryption Module

**Rationale:** Every subsequent security layer depends on env validation running before any handler fires. `ENCRYPTION_KEY` must be validated before token encryption can be used. The encryption module must exist before any call site is modified. Both are pure utility work with no external dependencies — zero infrastructure decisions required.

**Delivers:** Typed `env` object consumed by all lib modules; `encrypt()`/`decrypt()` functions available for integration; `CALENDLY_WEBHOOK_SIGNING_KEY` and `SESSION_SECRET` guaranteed to be non-null at startup.

**Addresses (from FEATURES.md P1):** Startup env validation, SESSION_SECRET fallback removal

**Avoids (from PITFALLS.md):** Webhook signature verification made optional (Pitfall 5), session invalidation cascade (Pitfall 8)

**Research flag:** Standard patterns. Zod env validation and AES-256-GCM are well-documented; no additional phase research needed.

---

### Phase 2: Token Security — Encryption Integration + Webhook Hardening

**Rationale:** Encryption module exists from Phase 1. Now consolidate token access (single function reads tokens) and add encrypt-on-write / decrypt-on-read at the two write sites and two read sites. Data migration for existing rows must ship in the same deployment as the code change. Webhook timestamp tightening and timing-safe email comparison are pure logic changes with the same deployment footprint.

**Delivers:** All Calendly OAuth tokens encrypted at rest with version-prefixed envelope; existing rows migrated; webhook replay window reduced from 3 minutes to 60 seconds; allowlist email comparisons are timing-safe.

**Uses (from STACK.md):** `crypto` built-in (AES-256-GCM), existing Prisma 5.7.1

**Implements (from ARCHITECTURE.md):** Encryption Module integration at OAuth callback + `calendlyRequest()` + `cancelBookingWithRetry()`

**Addresses (from FEATURES.md P1):** OAuth tokens encrypted at rest, webhook timestamp tolerance, timing-safe email comparisons

**Avoids (from PITFALLS.md):** Encrypting without migrating existing rows (Pitfall 1), missing decrypt in cancelBookingWithRetry (Pitfall 2), wrong encryption algorithm (Pitfall 3)

**Research flag:** Standard patterns. AES-256-GCM + Prisma data migration are well-established. No additional phase research needed.

---

### Phase 3: Rate Limiting

**Rationale:** Rate limiting is architecturally independent of token encryption and audit logging. It can be built in parallel with Phase 2 by a second developer, or sequentially after Phase 2. It is placed at Phase 3 (not earlier) because rate limit interference during integration testing of the encryption changes would complicate debugging. The Upstash infrastructure decision must be made before this phase begins.

**Delivers:** `middleware.ts` with sliding window rate limiting; auth endpoints (10/min), allowlist writes (30/min), read endpoints (120/min); webhook paths excluded from rate limiting; graceful degradation in dev (no Upstash required locally).

**Uses (from STACK.md):** `@upstash/ratelimit` + `@upstash/redis` (new packages); Upstash Redis free tier for Vercel; Railway Redis addon as alternative

**Implements (from ARCHITECTURE.md):** Middleware-Level Rate Limiting (Pattern 2); matcher excludes `/api/webhooks/*`

**Addresses (from FEATURES.md P2):** Rate limiting on all API endpoints

**Avoids (from PITFALLS.md):** In-memory rate limiting on Vercel serverless (Pitfall 4)

**Research flag:** Needs infrastructure decision. Verify Upstash free tier limits and confirm Edge runtime compatibility of `@upstash/ratelimit` ~2.x before implementation. Standard integration pattern once infrastructure is chosen.

---

### Phase 4: Audit Logging + Webhook Idempotency

**Rationale:** Requires a Prisma migration (new `AuditLog` model + `stripeEventId` column on `BookingAttempt`). Schema migrations carry deployment risk and are placed after the stateless security layers are stable. `AsyncLocalStorage` for actor context adds complexity that is easier to reason about when other changes are settled. Idempotency and audit logging share the same migration pass.

**Delivers:** Immutable `AuditLog` table capturing all allowlist mutations with actor, timestamp, and before/after state; `BookingAttempt` deduplicated by `calendlyEventUri` (unique) and `stripeEventId` (unique); Stripe subscription events idempotent.

**Uses (from STACK.md):** Prisma 5.7.1 `$use` middleware, `AsyncLocalStorage` (Node.js built-in), existing PostgreSQL

**Implements (from ARCHITECTURE.md):** Prisma Middleware for Audit Logging (Pattern 3); `AuditLog` model; idempotency keys on `BookingAttempt`

**Addresses (from FEATURES.md P1):** Audit logging for allowlist changes, webhook idempotency

**Avoids (from PITFALLS.md):** Audit log write breaking business operations (Pitfall 7), missing idempotency guard causing duplicate Stripe processing (Integration Gotchas)

**Research flag:** Standard patterns. Prisma `$use` is marked legacy in Prisma 5 (in favor of `$extends`); verify against Prisma 5.7.1 changelog before choosing the implementation path. `AsyncLocalStorage` pattern is well-documented for this use case.

---

### Phase 5: Test Coverage

**Rationale:** Each of the previous phases should have accompanying unit tests written immediately. Phase 5 is the completeness pass — adding the cross-cutting test suites that validate the interactions between hardened components: cross-user access enforcement, Stripe subscription lifecycle, guest check mode combinations, and encryption round-trip tests under error conditions.

**Delivers:** Vitest test suites for webhook signature validation (15+ cases), cross-user access enforcement, Stripe subscription lifecycle, guest check mode (15 combinations), encryption round-trip and error cases, audit log failure-mode behavior.

**Uses (from STACK.md):** Vitest 4.0.16 (installed), Playwright 1.57.0 (installed); no new testing libraries

**Implements:** Test coverage for all hardened paths from Phases 1-4

**Addresses (from FEATURES.md P1/P2):** All security test coverage items

**Avoids (from PITFALLS.md):** "Looks done but isn't" checklist (all 7 items require tests to confirm completeness)

**Research flag:** Standard patterns. Vitest + Next.js App Router testing patterns are well-documented. Guest check mode test extraction (refactoring `switch` block to pure function) is the only non-trivial step.

---

### Phase Ordering Rationale

- **Env validation must be first** because ENCRYPTION_KEY validation must fire before any token encryption code runs, and SESSION_SECRET validation must fire before session configuration is changed. Both downstream phases (2 and 4) depend on the env being validated.
- **Token encryption before rate limiting** because the OAuth callback must be stable before adding middleware that might interfere with auth flows during testing.
- **Webhook hardening inside Phase 2 (not separate)** because the changes (timestamp tolerance, timing-safe comparison) are in the same files as the token decryption changes — batching reduces deployment count and review overhead.
- **Rate limiting before audit logging** because rate limiting is stateless and lower risk; audit logging requires a database migration and `AsyncLocalStorage` context propagation — it benefits from the system being stable first.
- **Audit logging and idempotency together in Phase 4** because both require Prisma migrations; running migrations twice in separate phases increases deployment risk.
- **Tests integrated per phase, with Phase 5 as the completeness sweep** — security test coverage for cross-cutting concerns (cross-user access, full Stripe lifecycle) is easier to write once all hardened components are in place.

---

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 3 (Rate Limiting):** Verify `@upstash/ratelimit` ~2.x Edge runtime compatibility with Next.js 15.1.3 before writing middleware. Confirm Upstash free tier request limits are sufficient for early production traffic. Decide Railway fallback strategy (Railway Redis addon vs. Upstash for both environments) — this decision affects env var requirements.
- **Phase 4 (Audit Logging):** Verify Prisma 5.7.1 `$use` vs. `$extends` query extensions for the audit middleware pattern. Prisma 5 marks `$use` as legacy; `$extends` may be the preferred path, which has a different implementation shape.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** Zod env validation + `@t3-oss/env-nextjs` is the T3 stack standard; AES-256-GCM via Node.js `crypto` is NIST-standardized. No research needed.
- **Phase 2 (Token Security):** AES-256-GCM encryption + Prisma data migration are well-documented patterns. The consolidation of token refresh logic is a straightforward code refactor.
- **Phase 5 (Test Coverage):** Vitest test patterns for Next.js App Router route handlers are well-documented. Guest check mode extraction is a standard pure function refactor.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core decisions (Node crypto, Zod, Prisma AuditLog) are HIGH confidence from codebase inspection + NIST standards. New package versions (`@t3-oss/env-nextjs` ~0.10.x, `@upstash/ratelimit` ~2.x) are MEDIUM — WebSearch/WebFetch unavailable during research; verify exact versions on npmjs.com before `npm install`. |
| Features | HIGH | Grounded in direct codebase audit + OWASP Top 10 + RFC 9700. Feature gaps are confirmed against actual source files. Priority ordering is based on breach risk, not opinion. |
| Architecture | HIGH | Based on codebase inspection of actual files + Next.js 15 official middleware documentation. Build order is derived from real dependency analysis, not best practices speculation. One MEDIUM flag: Prisma 5 `$use` legacy status. |
| Pitfalls | HIGH | All 8 pitfalls are grounded in specific code paths (file names, line numbers). Failure modes are confirmed patterns from codebase structure, not hypothetical. |

**Overall confidence:** HIGH

---

### Gaps to Address

- **Package version verification:** `@t3-oss/env-nextjs`, `@upstash/ratelimit`, `@upstash/redis` versions were drawn from training knowledge (cutoff Aug 2025). Verify current versions on npmjs.com before Phase 3 planning. The APIs described are stable, but minor version differences may affect exact configuration.

- **Prisma `$use` vs. `$extends`:** Prisma 5 marks `$use` as the legacy middleware API in favor of `$extends` query extensions. Both work in Prisma 5.7.1, but `$extends` is the forward-compatible path. Verify which approach is preferred before Phase 4 implementation to avoid rework.

- **Upstash free tier limits:** The free tier supports approximately 10K requests/day. This is sufficient for early SaaS usage but should be validated against expected webhook + API traffic before committing to Upstash as the rate limiting backend. Railway Redis addon is the fallback.

- **ENCRYPTION_KEY rotation procedure:** The research recommends version-prefixing ciphertext (`enc:v1:...`) to support future key rotation. The rotation procedure itself (lazy rotation on read vs. background migration job) is not designed — this should be addressed in the runbook during Phase 2 planning.

- **Legacy Express file audit:** `.planning/research/PITFALLS.md` flags `app.js` and `server/routes/` as legacy code requiring careful deletion (check active Calendly webhook subscriptions, orphaned npm packages). This was identified as a pitfall but no dedicated research phase covers it. Treat as a prerequisite step within the earliest feasible phase or as a standalone pre-work task.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection — `src/lib/webhook.ts`, `src/lib/calendly.ts`, `src/lib/session.ts`, `src/lib/prisma.ts`, `src/lib/stripe.ts`, `prisma/schema.prisma`, `src/app/api/webhooks/calendly/route.ts`, `src/app/api/auth/calendly/callback/route.ts`, `package-lock.json` (all read 2026-02-20)
- `.planning/codebase/CONCERNS.md` — security audit of codebase (2026-02-20)
- Node.js `crypto` module — AES-256-GCM API (stable since Node.js 12; NIST SP 800-38D standard)
- Next.js 15 Middleware documentation — execution order, matcher config, Edge runtime constraints
- OWASP Top 10 (2021) — A02 Cryptographic Failures, A05 Security Misconfiguration, A07 Identification/Authentication
- OAuth 2.0 Security Best Current Practice (RFC 9700, 2025) — CSRF state parameter requirement
- iron-session v8 documentation — session invalidation behavior on password/cookieName change

### Secondary (MEDIUM confidence)

- Training knowledge (cutoff Aug 2025) — `@t3-oss/env-nextjs` ecosystem patterns, Upstash Rate Limit Next.js integration, Vercel serverless function model
- Prisma 5 `$use` middleware — training knowledge; Prisma 5 marks `$use` as legacy, `$extends` as preferred; verify against Prisma 5.7 changelog

### Tertiary (LOW confidence)

- Package versions for `@t3-oss/env-nextjs` (~0.10.x), `@upstash/ratelimit` (~2.x), `@upstash/redis` (~1.x) — training knowledge; WebSearch/WebFetch unavailable during research; verify on npmjs.com before installation

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*

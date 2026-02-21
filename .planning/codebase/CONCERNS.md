# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Hardcoded Branding String:**
- Issue: Branding suffix "Powered by PriCal" is hardcoded in webhook handler
- Files: `src/app/api/webhooks/calendly/route.ts` (line 319: `const PRICIAL_BRANDING`)
- Impact: Cannot dynamically customize cancellation message footer; requires code changes to modify branding
- Fix approach: Move to database configuration or environment variable; create a settings table for user-customizable branding

**Email Validation Regex Too Simplistic:**
- Issue: Email validation uses basic regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` which doesn't follow RFC 5322
- Files: `src/lib/utils.ts` (line 56)
- Impact: Will accept invalid email formats; may allow entries that bounce; incomplete validation of complex email addresses
- Fix approach: Use dedicated email validation library (e.g., `email-validator` or `zod` email validator) or implement RFC 5322 compliant regex

**Legacy app.js Still Present:**
- Issue: Old Express.js application (`app.js`) exists alongside modern Next.js app in `src/`
- Files: `app.js`, `server/routes/`, `views/`, `models/`, `migrations/` (pre-Prisma Sequelize)
- Impact: Confusion about code organization; unclear which routes are active; potential for deprecated code to be called; technical debt accumulation
- Fix approach: Fully migrate to Next.js API routes; remove old Express code; consolidate authentication flows

**Deprecated Database Migration System:**
- Issue: Project contains old Sequelize migrations alongside new Prisma schema
- Files: `migrations/`, `seeders/`, `.sequelizerc`, `config/config.js`
- Impact: Database state uncertainty; dual ORM confusion; difficult to track actual schema version
- Fix approach: Clean up old migration files; keep only Prisma migrations going forward; document migration history in git

**Two HTTP Client Libraries:**
- Issue: Both `axios` (modern app) and `node-fetch` (devDependency) are in dependencies
- Files: Package.json; `src/lib/calendly.ts` uses axios
- Impact: Unnecessary dependency bloat; inconsistent HTTP handling patterns across codebase
- Fix approach: Standardize on axios or native `fetch()` in Node 18+; remove unused library

## Security Considerations

**Non-Timing-Safe Email Comparison in Allowlist Checks:**
- Risk: Email comparison using `.includes()` and `.toLowerCase()` is not timing-safe; potential timing attack vector for attackers to infer allowlist contents
- Files: `src/app/api/webhooks/calendly/route.ts` (lines 137-142), `src/app/api/allowlists/[id]/entries/route.ts` (line 104)
- Current mitigation: Email addresses are hashed/converted to Set for performance, but Set membership test is not constant-time
- Recommendations: Use `crypto.timingSafeEqual()` for sensitive email comparisons; implement rate limiting on webhook endpoints; log suspicious patterns

**Unsafe Non-Null Assertion on Environment Variables:**
- Risk: Multiple environment variables asserted as non-null with `!` operator without validation; crash at runtime if missing
- Files: `src/lib/stripe.ts` (lines 3, 10-15), `src/lib/calendly.ts` (lines 120, 122), `src/app/api/webhooks/stripe/route.ts` (line 66)
- Current mitigation: `.env.local` file required before running (not validated by Next.js at build time)
- Recommendations: Validate environment variables at application startup using a schema validator (e.g., zod); fail fast with clear error messages; document required vars in README

**Weak Session Secret Fallback:**
- Risk: Session secret has fallback to hardcoded value in non-production
- Files: `src/lib/session.ts` (line 10: `process.env.SESSION_SECRET as string`)
- Current mitigation: Only applied when `NODE_ENV !== 'production'`
- Recommendations: Remove fallback entirely; require `SESSION_SECRET` in all environments; add startup validation

**Webhook Timestamp Tolerance Too Large:**
- Risk: 3-minute tolerance window (`180000ms`) for webhook timestamp validation is large; could allow delayed replay attacks
- Files: `src/lib/webhook.ts` (line 59: `toleranceMs: number = 180000`)
- Impact: Attackers have wider window to replay old webhook events (e.g., old booking cancellations or approvals)
- Recommendations: Reduce to 1-2 minutes; add distributed cache for nonce tracking to prevent replays entirely; implement webhook idempotency keys in database

**OAuth Tokens Stored Without Encryption:**
- Risk: Calendly access/refresh tokens stored in plaintext in PostgreSQL
- Files: `prisma/schema.prisma` (lines 21-22: `calendlyAccessToken`, `calendlyRefreshToken`)
- Current mitigation: Comment in schema says "stored encrypted in production" but code shows no encryption implementation
- Impact: Compromise of database exposes user calendars; tokens can be used for unauthorized Calendly API access
- Recommendations: Implement field-level encryption at application layer (e.g., `@node-rs/bcrypt` or similar); use Stripe-style token reference system; audit database access logs

## Performance Bottlenecks

**Inefficient Time Series Aggregation in Stats Route:**
- Problem: Comment in code acknowledges manual client-side date grouping instead of SQL aggregation
- Files: `src/app/api/dashboard/stats/route.ts` (lines 155-157)
- Cause: Using JavaScript to group booking attempts by date instead of `GROUP BY` in SQL; full dataset returned to application
- Improvement path: Replace `groupBy` with `aggregateRaw()` or raw SQL query for date-based aggregation; cache results; limit to last 30 days only

**N+1 Query Pattern in Email Duplicate Check:**
- Problem: Checking email existence in a loop instead of batch query
- Files: `src/app/api/allowlists/[id]/entries/route.ts` (lines 269-288: for loop with `findFirst` on each iteration)
- Cause: Adding 100 emails = 100 database queries (1 per email existence check)
- Improvement path: Batch query: `findMany({ where: { email: { in: normalizedEmails } } })` to check all at once; build Set from results; then create entries

**Missing Database Index on Case-Insensitive Email Search:**
- Problem: Allowlist entry search filters with `mode: 'insensitive'` without indexed support
- Files: `src/app/api/allowlists/[id]/entries/route.ts` (line 104)
- Cause: PostgreSQL CITEXT extension not used; text search without index performs sequential scan
- Improvement path: Enable CITEXT on email column; or maintain lowercase email index; add `@@index([email])` with collation config

**4-Second Hard Delay Before Webhook Cancellation:**
- Problem: Fixed `setTimeout(4000)` delay in webhook handler
- Files: `src/app/api/webhooks/calendly/route.ts` (lines 262-263)
- Cause: Engineered delay to ensure confirmation email arrives before cancellation; blocks webhook handler
- Impact: Webhook timeout risk if Calendly retries take longer; poor UX if multiple bookings process sequentially
- Improvement path: Use message queue (e.g., Bull, Temporal) for delayed cancellation; send cancellation asynchronously; add configurable delay in database

**Unoptimized Activity Log Pagination:**
- Problem: Page limit defaults to 25 and can be set arbitrarily high without validation
- Files: `src/app/api/allowlists/[id]/entries/route.ts` (line 85: `const limit = parseInt(searchParams.get('limit') || '25', 10)`)
- Cause: No upper bound on limit parameter; client could request 10,000 entries
- Improvement path: Add `Math.min(limit, 100)` cap; validate limit is positive integer; use cursor-based pagination for large datasets

## Fragile Areas

**Calendly API Integration with Manual Token Refresh:**
- Files: `src/lib/calendly.ts`, `src/app/api/webhooks/calendly/route.ts` (lines 321-355)
- Why fragile: Token refresh logic duplicated in webhook handler AND in `calendlyRequest()` utility; different retry strategies; no circuit breaker for failed refreshes
- Safe modification: Create centralized token manager service; use axios interceptor for automatic token refresh; add exponential backoff; test token expiration scenarios
- Test coverage: Missing integration tests for token refresh flow; no tests for 401 handling in webhook context

**Webhook Event Processing Without Idempotency:**
- Files: `src/app/api/webhooks/calendly/route.ts`, `src/app/api/webhooks/stripe/route.ts`
- Why fragile: No idempotency key tracking; duplicate webhook events create duplicate BookingAttempt records; Stripe webhook can fire multiple times
- Safe modification: Add `idempotencyKey` column to BookingAttempt; check before creating; implement webhook retry logic
- Test coverage: No tests for duplicate webhook delivery

**Database Cascading Deletes Without Audit Trail:**
- Files: `prisma/schema.prisma` (relations with `onDelete: Cascade`)
- Why fragile: Account deletion cascades delete all allowlists, entries, event types, and booking attempts with no audit record
- Safe modification: Create audit table before cascade; implement soft deletes with timestamp; require explicit confirmation with delay before actual deletion
- Test coverage: No tests for cascade delete behavior; no verification of orphaned records

**Guest Check Mode Logic Complexity:**
- Files: `src/app/api/webhooks/calendly/route.ts` (lines 154-206)
- Why fragile: 5 different guest check modes with overlapping validation logic; hard to reason about; easy to introduce permission bypass bugs
- Safe modification: Extract to decision tree/state machine; add unit tests for each mode combination; create test matrix (approved invitee, approved guests, unapproved guests, no guests)
- Test coverage: No unit tests for guest check logic; only integration with full webhook

## Scaling Limits

**Session Storage In-Process Only:**
- Current capacity: Single server; sessions lost on restart
- Limit: Deployment with multiple instances will lose session data; horizontal scaling breaks authentication
- Scaling path: Move to Redis-backed session store; use iron-session with Redis adapter; ensure secure session token signing

**Prisma Client Connections:**
- Current capacity: Default pool of 10 connections
- Limit: Heavy traffic will exhaust connection pool; slow database responses
- Scaling path: Increase `connection_limit` in DATABASE_URL; add read replicas for reporting queries; implement connection pooling with PgBouncer

**Webhook Processing Synchronously:**
- Current capacity: Each webhook blocks request handling; max 2 req/sec if each takes 500ms
- Limit: Traffic spikes cause timeouts; Calendly/Stripe retries trigger cascading failures
- Scaling path: Use message queue (Bull, Temporal) for async processing; return 202 Accepted immediately; process in background worker

**Email Validation Loop Not Batched:**
- Current capacity: Adding 100 emails = 100 queries; can process ~10-20 requests/sec per instance
- Limit: Large CSV import (1000+ emails) will timeout or fail
- Scaling path: Implement batch operations; use database COPY for bulk inserts; add progress tracking for UI feedback

## Test Coverage Gaps

**Webhook Security & Signature Validation:**
- What's not tested: Signature verification with invalid keys, missing headers, tampered payloads, timestamp validation boundary conditions
- Files: `src/lib/webhook.ts`, `src/app/api/webhooks/calendly/route.ts`, `src/app/api/webhooks/stripe/route.ts`
- Risk: Signature bypass could allow unauthorized webhook processing; no tests prevent regression
- Priority: HIGH - Critical security path

**Stripe Subscription Lifecycle:**
- What's not tested: Failed payments, subscription cancellations, tier downgrades, trial expiration, refunds
- Files: `src/app/api/webhooks/stripe/route.ts`, `src/lib/stripe.ts`
- Risk: Subscription state inconsistency; users may gain unauthorized access or lose access unexpectedly
- Priority: HIGH - Affects payment integrity

**Allowlist Permission Enforcement:**
- What's not tested: Cross-user access to allowlists, permission checks on CRUD operations, userId validation
- Files: `src/app/api/allowlists/[id]/entries/route.ts` (has checks but no tests)
- Risk: User could access or modify other user's allowlists
- Priority: HIGH - Security vulnerability

**Guest Check Mode Combinations:**
- What's not tested: All 5 modes × 3 scenarios (approved invitee, approved guests, no guests) = 15 combinations
- Files: `src/app/api/webhooks/calendly/route.ts`
- Risk: Logic bugs allow unauthorized bookings; hard to debug without tests
- Priority: MEDIUM - Core feature

**Token Refresh & Expiration:**
- What's not tested: Calendly token refresh on 401, retry logic, database update during retry, concurrent requests during refresh
- Files: `src/lib/calendly.ts` (lines 284-324), webhook handler (lines 321-355)
- Risk: Race conditions; failed refreshes break calendar access; duplicate updates
- Priority: MEDIUM - Common failure path

**API Rate Limiting & Abuse:**
- What's not tested: No rate limiting tests; no DDOS protection tests; no tests for resource exhaustion
- Files: All API routes
- Risk: Abuse attacks; someone can spam webhook endpoint or allowlist endpoints
- Priority: MEDIUM - Operational resilience

## Missing Critical Features

**No Audit Logging:**
- Problem: No record of who changed allowlist entries, when, or why; no change history
- Blocks: Compliance requirements, user support investigations, security incident response
- Impact: Cannot answer "what happened to user X's allowlist?" or "who added this email?"

**No Rate Limiting on API Endpoints:**
- Problem: No protection against bulk operations or abuse
- Blocks: Cannot prevent email enumeration attacks or CSV import spam
- Impact: Malicious actors can enumerate allowlist contents or trigger expensive operations

**No Webhook Retry Logic in Application:**
- Problem: Depends entirely on Calendly/Stripe retry mechanisms; if webhook handler returns error, local retry doesn't happen
- Blocks: Cannot guarantee at-least-once delivery semantics
- Impact: Lost webhook events; missed cancellations

**No Admin Dashboard or Support Tools:**
- Problem: Cannot view/manage user data, debug issues, or test webhook delivery
- Blocks: Support team cannot help customers; cannot diagnose webhook failures
- Impact: Longer support resolution time; customer churn

**No Encryption at Rest for Sensitive Data:**
- Problem: OAuth tokens, cancellation messages stored in plaintext
- Blocks: Compliance with data protection regulations (GDPR, CCPA, etc.)
- Impact: Major security incident if database is compromised

---

*Concerns audit: 2026-02-20*

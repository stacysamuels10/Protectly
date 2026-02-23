# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every security-sensitive path — webhook verification, token storage, session management, permission checks — must be hardened and tested before any new features are built.
**Current focus:** Phase 6 — Legacy Cleanup

## Current Position

Phase: 6 of 6 (Legacy Cleanup)
Plan: 1 of 2 in current phase
Status: Phase 06 In Progress
Last activity: 2026-02-23 — Phase 6 Plan 01 complete (15 legacy Express+Sequelize files removed via git rm; .gitignore cleaned of 7 dead rules; CLN-01 and CLN-02 satisfied)

Progress: [█████████░] ~92%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 3.0 min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | 3min | 3min |
| 02-token-security-webhook-hardening | 3 | 9min | 3min |

**Recent Trend:**
- Last 5 plans: 3min, 4min, 3min
- Trend: stable

*Updated after each plan completion*
| Phase 01-foundation P02 | 3min | 2 tasks | 4 files |
| Phase 02-token-security P01 | 4min | 3 tasks | 3 files |
| Phase 02-token-security P02 | 3min | 2 tasks | 4 files |
| Phase 02-token-security-webhook-hardening P03 | 2 | 1 tasks | 1 files |
| Phase 03-rate-limiting P01 | 1min | 2 tasks | 3 files |
| Phase 03-rate-limiting P02 | 2min | 2 tasks | 3 files |
| Phase 04-audit-logging P01 | 2min | 2 tasks | 3 files |
| Phase 04-audit-logging P02 | 2min | 2 tasks | 3 files |
| Phase 05-security-test-coverage P02 | 1min | 2 tasks | 2 files |
| Phase 05-security-test-coverage P03 | 1min | 1 tasks | 1 files |
| Phase 05-security-test-coverage P01 | 2min | 2 tasks | 4 files |
| Phase 06-legacy-cleanup P01 | 1 | 2 tasks | 16 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Security before features: Concerns audit revealed unencrypted tokens, missing tests, legacy code
- OK to restructure: User explicitly chose "break it if needed" over backward compatibility
- Skip performance fixes: Stay focused on security + cleanup; performance is next milestone
- [Phase 01-foundation]: ENCRYPTION_KEY stored as 64 hex chars (32 bytes) matching AES-256-GCM key size; generated per-environment and never committed
- [Phase 01-foundation]: CALENDLY_WEBHOOK_SIGNING_KEY and SESSION_SECRET made unconditionally required in env schema — closes conditional bypass security gap, enforces ENV-01 and ENV-02
- [Phase 01-foundation]: Webhook signature verification is unconditional — env.CALENDLY_WEBHOOK_SIGNING_KEY is always required at startup; conditional bypass removed
- [Phase 01-foundation]: All security-critical lib files (session.ts, stripe.ts, calendly.ts) now use typed env from @/env; non-null ! assertions removed as typed env guarantees string
- [Phase 01-foundation]: prisma.ts intentionally excluded from env migration — Prisma reads DATABASE_URL from process.env by design
- [Phase 01-foundation]: Mock @/env in encryption test: Stripe keys absent from .env.local; vi.mock provides only ENCRYPTION_KEY for test isolation
- [Phase 01-foundation]: enc:v1: version prefix in ciphertext envelope enables future key rotation without breaking existing stored tokens
- [Phase 02-token-security]: No plaintext-read guard at write path — Plan 03 migration script handles existing rows; write path always encrypts
- [Phase 02-token-security]: isEmailApproved converted from arrow const to named function; allowedEmails Set renamed to allowedEmailHashes storing SHA-256 digests
- [Phase 02-token-security]: Webhook timestamp tolerance reduced to 60s; no tests relied on 61–180s range so no test updates needed
- [Phase 02-token-security P02]: Refactor phase skipped — decrypt try/catch is two lines in each file; extraction adds cross-file dependency for minimal gain
- [Phase 02-token-security P02]: cancelBookingWithRetry tested via POST handler integration path (function not exported); vi.useFakeTimers() bypasses 4-second delay
- [Phase 02-token-security P02]: vi.mock('@/lib/encryption') with enc:v1:mocked: prefix enables exact encrypt/decrypt call-site assertions
- [Phase 02-token-security-webhook-hardening]: Migration script is self-contained (inlines encrypt() from crypto) — importing @/lib/encryption would pull in @/env requiring all 13 app env vars; migration only needs ENCRYPTION_KEY and DATABASE_URL
- [Phase 02-token-security-webhook-hardening]: Recommended deploy order: run migration against production DB before deploying Plans 01+02 app code — avoids any window where decrypt() is called on plaintext rows
- [Phase 02-token-security-webhook-hardening]: BigInt(0) used instead of 0n literal in migration script — BigInt literals require ES2020 target; tsconfig uses ES2017
- [Phase 03-rate-limiting]: Upstash vars declared .optional() in env schema — app starts without Upstash configured; graceful degradation in local dev and test
- [Phase 03-rate-limiting]: Packages pinned to exact versions confirmed from npm registry on 2026-02-22: @upstash/ratelimit@2.0.8 and @upstash/redis@1.36.2
- [Phase 03-rate-limiting]: vi.doMock used instead of vi.mock for mocks that must persist across vi.resetModules() calls; class-based constructors required for 'new' keyword in mocked modules
- [Phase 03-rate-limiting]: Iron-session getIronSession(request, new Response(), options) confirmed working in iron-session 8.0.1 with Node.js middleware runtime
- [Phase 03-rate-limiting]: vitest.config.ts include pattern extended to cover root-level test files — required for middleware.test.ts discovery
- [Phase 04-audit-logging]: Used prisma db push instead of prisma migrate dev — shadow database fails due to missing initial migration; db push syncs schema directly
- [Phase 04-audit-logging]: AuditLog.userId is NOT a foreign key — keeps audit log independent of user lifecycle (append-only immutability)
- [Phase 04-audit-logging]: DELETE handler changed from deleteMany to delete since entry existence is verified before audit log creation
- [Phase 04-audit-logging P02]: Calendly dedup key is invitee URI (not scheduled_event URI) -- unique per invitee even in group events
- [Phase 04-audit-logging P02]: Both webhook handlers use INSERT-or-fail via P2002 catch (not check-then-act) for race-safe deduplication
- [Phase 04-audit-logging P02]: Stripe handler migrated from process.env.STRIPE_WEBHOOK_SECRET! to typed env.STRIPE_WEBHOOK_SECRET
- [Phase 05-security-test-coverage P02]: Stripe test mocks constructEvent return value (not full Stripe SDK) for targeted handler-level testing
- [Phase 05-security-test-coverage P02]: Allowlist tests use dynamic imports to test 3 route files from a single test file
- [Phase 05-security-test-coverage P02]: Cross-user access asserts 404 (not 403) matching security-by-obscurity design preventing resource enumeration
- [Phase 05-security-test-coverage P03]: No new mock infrastructure needed -- reused existing vi.mock patterns for @/env, @/lib/encryption, ./prisma, and axios spy
- [Phase 05-security-test-coverage P01]: evaluateGuestCheckMode accepts string mode (not typed GuestCheckMode enum) -- avoids Prisma import in pure module; enum values are string-compatible
- [Phase 05-security-test-coverage P01]: Webhook test helper makeValidSignature mirrors production HMAC-SHA256 signing exactly -- tests verify our verification code, not Calendly's signing
- [Phase 05-security-test-coverage P01]: All timestamp boundary tests use vi.useFakeTimers() with vi.setSystemTime() -- prevents flaky tests from wall-clock drift
- [Phase 06-legacy-cleanup]: git rm used (not rm) to remove legacy files — ensures removals are staged in git index immediately
- [Phase 06-legacy-cleanup]: Out-of-scope legacy .gitignore entries preserved (components, actions, reducers, buildscript.js, Procfile.dev, public/App.js, public/App.css) — those directories still tracked, cleanup is out of scope for this phase

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3: Verify @upstash/ratelimit ~2.x Edge runtime compatibility with Next.js 15.1.3 before planning
- Phase 3: Confirm Upstash free tier limits vs. expected webhook + API traffic; decide Railway Redis fallback strategy
- Phase 4: Verify Prisma 5.7.1 $use vs. $extends for audit middleware before planning — $use is marked legacy in Prisma 5
- Phase 2: Decide ENCRYPTION_KEY rotation procedure (lazy rotation on read vs. background migration) before implementation

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 06-01-PLAN.md — 15 legacy Express+Sequelize files removed via git rm; .gitignore cleaned of 7 dead rules; CLN-01 and CLN-02 satisfied
Resume file: None

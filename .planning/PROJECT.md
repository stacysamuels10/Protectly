# Protectly — Security Hardening & Cleanup

## What This Is

Protectly is a Calendly booking protection service that intercepts new bookings via webhooks and cancels unauthorized ones based on user-managed allowlists. It uses Next.js 15 with App Router, Prisma/PostgreSQL, Calendly OAuth, and Stripe billing. This milestone focuses on hardening the existing codebase to audit-ready security standards and removing legacy code.

## Core Value

Every security-sensitive path — webhook verification, token storage, session management, permission checks — must be hardened and tested before any new features are built.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ Calendly OAuth signup/login flow — existing
- ✓ Webhook-driven booking interception and cancellation — existing
- ✓ Allowlist management (CRUD, CSV import) — existing
- ✓ 5 guest check modes (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL) — existing
- ✓ Stripe subscription billing with checkout and portal — existing
- ✓ Dashboard with stats, activity log, settings — existing
- ✓ Webhook signature verification (HMAC-SHA256) — existing
- ✓ iron-session cookie-based authentication — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] OAuth tokens encrypted at rest in database
- [ ] Environment variables validated at startup with schema (zod)
- [ ] Weak session secret fallback removed — require SESSION_SECRET in all environments
- [ ] Webhook timestamp tolerance tightened to 60 seconds
- [ ] Webhook idempotency — deduplicate events via idempotency key tracking
- [ ] Timing-safe email comparisons in allowlist checks
- [ ] Rate limiting on all API endpoints
- [ ] Audit logging for allowlist changes and security events
- [ ] Test coverage: webhook signature validation (invalid keys, missing headers, tampered payloads)
- [ ] Test coverage: Stripe subscription lifecycle (failed payments, cancellations, downgrades)
- [ ] Test coverage: allowlist permission enforcement (cross-user access)
- [ ] Test coverage: guest check mode combinations (5 modes x 3 scenarios)
- [ ] Test coverage: Calendly token refresh and expiration handling
- [ ] Legacy Express app removed (app.js, server/, views/, models/)
- [ ] Deprecated Sequelize migrations removed (migrations/, seeders/, .sequelizerc, config/config.js)
- [ ] HTTP client consolidated (remove unused node-fetch or standardize on fetch)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Performance optimizations (N+1 queries, missing indexes, webhook delay) — deferred to next milestone
- Admin dashboard or support tools — deferred to next milestone
- New features or UI changes — hardening only
- Database scaling (connection pooling, read replicas) — not needed at current traffic
- Mobile app — web-first

## Context

- Codebase mapped on 2026-02-20 — see `.planning/codebase/` for full analysis
- CONCERNS.md identified 6 categories of issues; this milestone addresses security, test gaps, and legacy cleanup
- The legacy Express app (`app.js`) and Sequelize migrations (`migrations/`) coexist with the modern Next.js/Prisma stack and should be removed
- OAuth tokens are stored in plaintext despite a comment in schema saying "stored encrypted in production"
- No rate limiting exists on any endpoint
- No audit trail for allowlist modifications
- Restructuring is acceptable — backward compatibility is not a constraint

## Constraints

- **Stack**: Stay within existing Next.js 15 / Prisma / PostgreSQL stack
- **Deployment**: Must remain deployable to Vercel and Railway
- **Auth**: Keep iron-session approach but harden it
- **Testing**: Use existing Vitest + Playwright setup

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security before features | Concerns audit revealed unencrypted tokens, missing tests, legacy code | — Pending |
| OK to restructure | User explicitly chose "break it if needed" over backward compatibility | — Pending |
| Skip performance fixes | Stay focused on security + cleanup; performance is next milestone | — Pending |

---
*Last updated: 2026-02-20 after initialization*

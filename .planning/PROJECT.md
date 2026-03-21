# Protectly

## What This Is

Protectly is a Calendly booking protection service that intercepts new bookings via webhooks and cancels unauthorized ones based on user-managed allowlists. It uses Next.js 15 with App Router, Prisma/PostgreSQL, Calendly OAuth, and Stripe billing. The codebase has been security-hardened and is now adding production infrastructure: observability, transactional email, and trial management.

## Core Value

Protect Calendly users from unauthorized bookings by automatically cancelling meetings from people not on their allowlist — reliably, with full visibility into what happened and why.

## Current Milestone: v1.0 Core Infrastructure

**Goal:** Make Protectly production-ready with error monitoring, product analytics, structured logging, transactional email notifications, and automated trial expiration handling.

**Target features:**
- Sentry error monitoring with source maps and alerts
- PostHog product analytics with key event tracking
- Structured JSON logging for production debugging
- Transactional email infrastructure (Resend/Postmark)
- Email notifications for approved and rejected bookings
- Trial expiry warning emails (3-day, 1-day, expired)
- Trial expiration logic with automated downgrade
- User email notification preferences

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Calendly OAuth signup/login flow — existing
- ✓ Webhook-driven booking interception and cancellation — existing
- ✓ Allowlist management (CRUD, CSV import) — existing
- ✓ 5 guest check modes (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL) — existing
- ✓ Stripe subscription billing with checkout and portal — existing
- ✓ Dashboard with stats, activity log, settings — existing
- ✓ Webhook signature verification (HMAC-SHA256) — existing
- ✓ iron-session cookie-based authentication — existing
- ✓ OAuth tokens encrypted at rest — v0.1 Phase 2
- ✓ Environment variables validated at startup (Zod) — v0.1 Phase 1
- ✓ SESSION_SECRET required in all environments — v0.1 Phase 1
- ✓ Webhook timestamp tolerance tightened to 60s — v0.1 Phase 2
- ✓ Webhook idempotency via idempotency key tracking — v0.1 Phase 4
- ✓ Timing-safe email comparisons — v0.1 Phase 2
- ✓ Rate limiting on all API endpoints (Upstash) — v0.1 Phase 3
- ✓ Audit logging for allowlist changes — v0.1 Phase 4
- ✓ Security test coverage (webhook, Stripe, allowlist, guest modes, token refresh) — v0.1 Phase 5
- ✓ Legacy Express app removed — v0.1 Phase 6
- ✓ HTTP client consolidated to native fetch — v0.1 Phase 6
- ✓ Sentry error monitoring with PII scrubbing and source maps — v1.0 Phase 7
- ✓ PostHog product analytics with 9 event types tracked — v1.0 Phase 7
- ✓ Structured JSON logging (pino) replacing all console.log/error — v1.0 Phase 7
- ✓ Transactional email infrastructure (Resend + React Email, 5 templates) — v1.0 Phase 8
- ✓ User email notification preferences (3 per-type toggles) — v1.0 Phase 8

### Active

<!-- Current scope. Building toward these. -->
- [ ] Email notification on booking approved
- [ ] Email notification on booking rejected with "Add to allowlist" action
- [ ] Trial expiry warning emails (3 days before, on expiry, on downgrade)
- [ ] Trial expiration logic with automated downgrade to FREE tier

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Performance optimizations — deferred to M4
- Admin dashboard or support tools — deferred to M2/M3
- New UI features beyond email preferences — deferred to M2
- Database scaling (connection pooling, read replicas) — not needed at current traffic
- Mobile app — web-first
- Domain allowlisting — M3
- Activity log / audit log UI — M3

## Context

- Security hardening milestone (v0.1) completed 2026-02-23 — all 86 tests passing
- Codebase mapped on 2026-02-20 — see `.planning/codebase/` for full analysis
- Legacy Express app and Sequelize artifacts fully removed
- Rate limiting via Upstash Redis, audit logging via Prisma AuditLog model already in place
- No email sending capability exists yet
- No error monitoring or analytics in production
- All logging is unstructured console.log/error
- Trial expiration has no enforcement — users on trial stay on PRO indefinitely

## Constraints

- **Stack**: Stay within existing Next.js 15 / Prisma / PostgreSQL stack
- **Deployment**: Must remain deployable to Vercel and Railway
- **Auth**: Keep iron-session approach
- **Testing**: Use existing Vitest + Playwright setup
- **Email**: Use Resend or Postmark (free tier compatible)
- **Cron**: Vercel Cron for scheduled tasks (trial expiry checks)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security before features | Concerns audit revealed unencrypted tokens, missing tests, legacy code | ✓ Good — v0.1 complete |
| OK to restructure | User explicitly chose "break it if needed" over backward compatibility | ✓ Good — clean codebase |
| Skip performance fixes | Stay focused on security + cleanup; performance is next milestone | ✓ Good — deferred to M4 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after Phase 8 (Email Infrastructure & Preferences) complete*

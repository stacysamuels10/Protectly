# Protectly

## What This Is

Protectly is a Calendly booking protection service that intercepts new bookings via webhooks and cancels unauthorized ones based on user-managed allowlists. It uses Next.js 15 with App Router, Prisma/PostgreSQL, Calendly OAuth, and Stripe billing. The codebase is security-hardened with production observability (Sentry, PostHog, structured logging), transactional email notifications, and automated trial management.

## Core Value

Protect Calendly users from unauthorized bookings by automatically cancelling meetings from people not on their allowlist — reliably, with full visibility into what happened and why.

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
- ✓ OAuth tokens encrypted at rest — v0.1
- ✓ Environment variables validated at startup (Zod) — v0.1
- ✓ Webhook hardening (60s tolerance, idempotency, timing-safe) — v0.1
- ✓ Rate limiting on all API endpoints (Upstash) — v0.1
- ✓ Audit logging for allowlist changes — v0.1
- ✓ Security test coverage — v0.1
- ✓ Legacy Express app removed, HTTP client consolidated — v0.1
- ✓ Sentry error monitoring with PII scrubbing and source maps — v1.0
- ✓ PostHog product analytics (9 events) — v1.0
- ✓ Structured JSON logging (pino) — v1.0
- ✓ Transactional email infrastructure (Resend + React Email) — v1.0
- ✓ Email notification preferences (3 per-type toggles) — v1.0
- ✓ Booking approved/rejected email notifications — v1.0
- ✓ Trial expiration with automated downgrade and warning emails — v1.0

- ✓ Privacy Policy and Terms of Service with app-wide legal integration — v1.1
- ✓ Onboarding wizard (3-step modal) for first-time users — v1.1
- ✓ Empty state improvements for allowlist and activity pages — v1.1
- ✓ CSV import (Pro+ gated) and export for allowlists — v1.1
- ✓ Help center with accordion FAQ (18 items) — v1.1
- ✓ Comparison landing page (/compare) — v1.1
- ✓ Beta onboarding guide with known limitations — v1.1

### Active

<!-- Current scope. Building toward these. -->

## Current Milestone: v1.2 Protection & Visibility

**Goal:** Expand booking protection with domain-level allowlisting and give users full visibility into protection activity.

**Target features:**
- Domain allowlisting (e.g., @company.com)
- Activity log / audit log UI

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Performance optimizations — deferred to M4
- Admin dashboard or support tools — deferred to M2/M3
- Database scaling (connection pooling, read replicas) — not needed at current traffic
- Mobile app — web-first
- Domain allowlisting — moved to Active (v1.2)
- Activity log / audit log UI — moved to Active (v1.2)

## Context

- v0.1 Security Hardening shipped 2026-02-23 — all security-sensitive paths hardened
- v1.0 Core Infrastructure shipped 2026-03-21 — production observability, email, trial management
- v1.1 Launch Readiness shipped 2026-03-26 — legal, onboarding, CSV, help center, comparison page
- v1.2 Protection & Visibility started 2026-03-26 — domain allowlisting, activity log UI
- 160 tests passing across 24 test files
- Codebase: Next.js 15, Prisma/PostgreSQL, Vercel + Railway deployment
- Email: Resend with React Email templates, from "PriCal Notifications <notifications@prical.io>"
- Observability: Sentry (error monitoring), PostHog (product analytics), pino (structured logging)
- Trial management: Vercel Cron at 9am UTC, idempotent downgrade, write-first email ordering
- User setup needed: Sentry DSN, PostHog key, Resend API key + domain verification, CRON_SECRET

## Constraints

- **Stack**: Next.js 15 / Prisma / PostgreSQL
- **Deployment**: Vercel (frontend) + Railway (DB)
- **Auth**: iron-session cookie-based
- **Testing**: Vitest + Playwright
- **Email**: Resend (3,000 free/month)
- **Cron**: Vercel Cron (daily on Hobby plan)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Security before features | Concerns audit revealed unencrypted tokens, missing tests, legacy code | ✓ Good — v0.1 complete |
| OK to restructure | User explicitly chose "break it if needed" over backward compatibility | ✓ Good — clean codebase |
| Resend over Postmark | 3,000 free emails/month, React Email integration, no inbound email need | ✓ Good — clean DX |
| pino over winston | 4x faster, JSON by default, server-only guard prevents client bundling | ✓ Good — zero console calls remain |
| Strip all PII from Sentry | Compliance-safe; stack trace + request path sufficient for debugging | ✓ Good |
| Database user ID for PostHog | No PII leak to analytics; stable internal identifier | ✓ Good |
| Write-first email ordering | Prevents duplicate emails on cron retry; idempotent by design | ✓ Good |
| Vercel Cron at 9am UTC | Warning emails arrive during business hours for US/EU users | — Pending |

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
*Last updated: 2026-03-27 after Phase 15 (Domain Schema) complete*

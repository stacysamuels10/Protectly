# Milestones

## v1.2 Protection & Visibility (Shipped: 2026-03-28)

**Phases completed:** 4 phases, 8 plans, 10 tasks

**Key accomplishments:**

- DomainEntry Prisma model with domain allowlisting constraints, AuditAction enum extended with ADD_DOMAIN/REMOVE_DOMAIN, and TIER_LIMITS updated with domain entry quotas per tier
- Domain CRUD API routes (POST + DELETE) with @ normalization, free provider blocking, tier limits, audit-first ADD_DOMAIN/REMOVE_DOMAIN logging, and PostHog tracking — 18 tests all passing
- AddDomainDialog (POST to /api/allowlists/{id}/domains) and DomainAllowlistSection (domain table with Globe icon, Domain badge, delete) — two new client components with 19 passing unit tests
- Allowlist page updated to fetch domainEntries via Prisma, render AddDomainDialog in header, DomainAllowlistSection as a card, and domain usage row with progress bar in the usage card
- Tabs UI Primitive
- Debounced email search input (300ms, ?q= URL param) and rejection reason subtitles on REJECTED rows added to ActivityLogClient
- AddToAllowlistButton dropdown lets users add a rejected invitee's email or domain to their allowlist directly from the activity log, with success/error toast feedback and disabled "Added" state

---

## v1.1 Launch Readiness (Shipped: 2026-03-26)

**Phases completed:** 4 phases, 8 plans, 12 tasks

**What shipped:**

- Privacy Policy + Terms of Service with app-wide legal integration (footer, signup CTA, upgrade card)
- 3-step onboarding wizard (Radix Dialog modal) with PostHog tracking and skip-at-every-step
- Empty state improvements for allowlist and activity pages with icon + CTA pattern
- CSV import (Pro+ gated, papaparse, batch processing, progress indicator) and export (all users)
- Help center with 18 FAQ items across 4 accordion sections + beta onboarding guide
- Comparison landing page with 8-row feature table + time savings narrative

**Key outcomes:**

- Launch-ready user experience (legal compliance, onboarding, help docs)
- Data portability (CSV import/export)
- Content marketing foundation (comparison page, help center)
- 160 tests passing (23 new tests added in this milestone)

---

## v1.0 Core Infrastructure (Shipped: 2026-03-21)

**Phases completed:** 4 phases, 7 plans, 9 tasks

**What shipped:**

- Structured JSON logging (pino) replacing all 43 console calls with server-only guard
- Sentry error monitoring with PII-scrubbing beforeSend, source map uploads, and global-error.tsx
- PostHog product analytics tracking 9 events with serverless-safe flush
- Resend transactional email with sendEmail() utility and 5 React Email templates
- Email notification preferences (3 per-type Switch toggles on settings page)
- Preference-gated booking approved/rejected emails with "Add to allowlist" CTA
- Idempotent trial expiry cron (Vercel Cron, write-first ordering, CRON_SECRET guard)

**Key outcomes:**

- Production-ready observability (errors, analytics, structured logs)
- User communication pipeline (transactional email end-to-end)
- Revenue integrity (trial expiration enforced automatically)
- 137 tests passing (51 new tests added in this milestone)

---

## v0.1 — Security Hardening & Cleanup

**Completed:** 2026-02-23
**Phases:** 6 (all complete)

**What shipped:**

- Environment validation at startup (Zod schema)
- OAuth token encryption at rest (AES-256-GCM)
- Webhook hardening (60s tolerance, idempotency, timing-safe comparisons)
- Rate limiting on all API endpoints (Upstash Redis)
- Audit logging for allowlist changes
- Security test coverage (webhook signatures, Stripe lifecycle, allowlist ACL, guest modes, token refresh)
- Legacy Express app + Sequelize artifacts removed
- HTTP client consolidated to native fetch
- 86 tests passing

**Key outcomes:**

- All security-sensitive paths hardened and tested
- Codebase modernized — single Next.js 15 / Prisma stack
- Production-ready security posture

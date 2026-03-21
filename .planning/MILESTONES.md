# Milestones

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

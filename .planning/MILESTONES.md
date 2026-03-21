# Milestones

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

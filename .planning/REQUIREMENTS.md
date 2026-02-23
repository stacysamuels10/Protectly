# Requirements: Protectly — Security Hardening & Cleanup

**Defined:** 2026-02-20
**Core Value:** Every security-sensitive path — webhook verification, token storage, session management, permission checks — must be hardened and tested before any new features are built.

## v1 Requirements

Requirements for this hardening milestone. Each maps to roadmap phases.

### Environment & Configuration

- [x] **ENV-01**: Application validates all required environment variables at startup using zod schema and fails fast with clear error messages if any are missing
- [x] **ENV-02**: SESSION_SECRET weak fallback is removed — app refuses to start without a valid SESSION_SECRET in all environments

### Token Security

- [x] **TOK-01**: Calendly OAuth access and refresh tokens are encrypted at rest using AES-256-GCM before storage in PostgreSQL
- [x] **TOK-02**: All existing plaintext tokens in the database are migrated to encrypted format via a one-time migration script
- [x] **TOK-03**: Token decryption is handled transparently in all read paths (calendlyRequest helper and cancelBookingWithRetry)

### Webhook Hardening

- [x] **WHK-01**: Webhook timestamp tolerance is tightened from 180 seconds to 60 seconds
- [x] **WHK-02**: Duplicate webhook events are detected and skipped via idempotency key tracking (Calendly: invitee URI, Stripe: event ID)
- [x] **WHK-03**: Email comparisons in allowlist checks use timing-safe comparison via crypto.timingSafeEqual on hashed values

### Access Control

- [x] **ACL-01**: All API endpoints have rate limiting enforced (webhook: 100/min by IP, allowlist writes: 30/min by user, auth: 10/min by IP)
- [x] **ACL-02**: All allowlist changes (add, remove, bulk import, clear) are recorded in an audit log with userId, action, target, and timestamp

### Security Test Coverage

- [ ] **TST-01**: Webhook signature validation has tests covering: valid signature, invalid key, missing headers, tampered payload, timestamp at boundary (59s/61s), expired timestamp
- [x] **TST-02**: Stripe subscription lifecycle has tests covering: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed, duplicate event idempotency
- [x] **TST-03**: Allowlist permission enforcement has tests covering: cross-user GET/POST/DELETE access returns 403/404
- [ ] **TST-04**: Guest check mode has tests covering all 5 modes x 3 scenarios (approved invitee, approved guests, unapproved guests) via extracted pure function
- [ ] **TST-05**: Calendly token refresh has tests covering: 401 triggers refresh, retry with new token succeeds, failed refresh is handled gracefully

### Legacy Cleanup

- [ ] **CLN-01**: Legacy Express application removed (app.js, server/, views/, models/)
- [ ] **CLN-02**: Deprecated Sequelize artifacts removed (migrations/, seeders/, .sequelizerc, config/config.js)
- [ ] **CLN-03**: Unused HTTP client library removed and codebase standardized on a single HTTP client

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Operational Resilience

- **OPS-01**: Centralized token manager with mutex to eliminate race condition in concurrent token refreshes
- **OPS-02**: Structured security event logging (JSON format) compatible with log aggregation services
- **OPS-03**: OAuth state parameter CSRF protection on Calendly auth flow

### User-Facing

- **UX-01**: Audit log UI on dashboard showing allowlist change history
- **UX-02**: Idempotency status surfaced in activity log ("duplicate event detected, skipped")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Performance optimizations (N+1 queries, missing indexes, webhook delay) | Deferred to next milestone — security first |
| Admin dashboard or support tools | Deferred to next milestone |
| Redis session store | iron-session cookies are stateless by design — no server-side store needed |
| PostgreSQL TDE (transparent data encryption) | Doesn't protect application layer; incompatible with Railway |
| mTLS on webhook endpoints | Calendly/Stripe don't support client certificates |
| Custom rate limiter from scratch | Use battle-tested library instead |
| Mobile app | Web-first, deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 1 | Complete |
| ENV-02 | Phase 1 | Complete |
| TOK-01 | Phase 2 | Complete |
| TOK-02 | Phase 2 | Complete |
| TOK-03 | Phase 2 | Complete |
| WHK-01 | Phase 2 | Complete |
| WHK-02 | Phase 4 | Complete |
| WHK-03 | Phase 2 | Complete |
| ACL-01 | Phase 3 | Complete |
| ACL-02 | Phase 4 | Complete |
| TST-01 | Phase 5 | Pending |
| TST-02 | Phase 5 | Complete |
| TST-03 | Phase 5 | Complete |
| TST-04 | Phase 5 | Pending |
| TST-05 | Phase 5 | Pending |
| CLN-01 | Phase 6 | Pending |
| CLN-02 | Phase 6 | Pending |
| CLN-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-22 after Phase 2 Plan 01 completion (TOK-01, WHK-01, WHK-03 closed)*

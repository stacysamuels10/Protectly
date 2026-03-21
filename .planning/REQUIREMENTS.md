# Requirements: Protectly

**Defined:** 2026-03-21
**Core Value:** Protect Calendly users from unauthorized bookings by automatically cancelling meetings from people not on their allowlist — reliably, with full visibility into what happened and why.

## v0.1 Requirements (Complete)

All 18 security hardening requirements shipped. See MILESTONES.md for details.

## v1.0 Requirements

Requirements for Core Infrastructure milestone. Each maps to roadmap phases.

### Observability

- [x] **OBS-01**: Sentry SDK installed with source map uploads and error alerts configured
- [x] **OBS-02**: PostHog SDK installed with key events tracked (signup, add_email, upgrade_click, webhook_received) and user identification working
- [x] **OBS-03**: All console.log/error calls replaced with structured JSON logger (pino) including request ID, user ID, and action context

### Email

- [x] **EMAIL-01**: Email sending infrastructure set up (Resend account, sending utility in lib/email.ts, branded templates via React Email)
- [ ] **EMAIL-02**: User receives email when a booking is approved (event details, link to activity log)
- [ ] **EMAIL-03**: User receives email when a booking is rejected (who tried to book, why rejected, "Add to allowlist" CTA)
- [x] **EMAIL-04**: User can configure email notification preferences (approved bookings, rejected bookings) from settings page

### Trial

- [ ] **TRIAL-01**: Expired trials automatically downgrade user to FREE tier via daily Vercel Cron job
- [ ] **TRIAL-02**: User receives warning emails before trial expires (3 days before and on expiry day) and notification when downgraded

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Notifications

- **NOTIF-01**: Weekly summary email (booking stats, allowlist activity)

### Analytics

- **ANLYT-01**: PostHog dashboard created with key metrics

### Operational Resilience

- **OPS-01**: Centralized token manager with mutex to eliminate race condition in concurrent token refreshes
- **OPS-03**: OAuth state parameter CSRF protection on Calendly auth flow

### User-Facing

- **UX-01**: Audit log UI on dashboard showing allowlist change history
- **UX-02**: Idempotency status surfaced in activity log ("duplicate event detected, skipped")

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Performance optimizations | Deferred to M4 |
| Admin dashboard / support tools | Deferred to M2/M3 |
| Domain allowlisting | M3 scope |
| Activity log / audit log UI | M3 scope |
| Mobile app | Web-first |
| Open/click tracking pixels on emails | Anti-feature per research — use PostHog events on CTAs instead |
| SendGrid / raw HTML email templates | Anti-pattern — use Resend + React Email |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBS-01 | Phase 7 | Complete |
| OBS-02 | Phase 7 | Complete |
| OBS-03 | Phase 7 | Complete |
| EMAIL-01 | Phase 8 | Complete |
| EMAIL-02 | Phase 9 | Pending |
| EMAIL-03 | Phase 9 | Pending |
| EMAIL-04 | Phase 8 | Complete |
| TRIAL-01 | Phase 10 | Pending |
| TRIAL-02 | Phase 10 | Pending |

**Coverage:**
- v1.0 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation (Phases 7-10)*

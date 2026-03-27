# Roadmap: Protectly

## Milestones

- ✅ **v0.1 Security Hardening & Cleanup** - Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.0 Core Infrastructure** - Phases 7-10 (shipped 2026-03-21)
- ✅ **v1.1 Launch Readiness** - Phases 11-14 (shipped 2026-03-26)
- 🚧 **v1.2 Protection & Visibility** - Phases 15-18 (in progress)

## Phases

<details>
<summary>✅ v0.1 Security Hardening & Cleanup (Phases 1-6) — SHIPPED 2026-02-23</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-02-22
- [x] Phase 2: Token Security & Webhook Hardening (3/3 plans) — completed 2026-02-22
- [x] Phase 3: Rate Limiting (2/2 plans) — completed 2026-02-22
- [x] Phase 4: Audit Logging & Webhook Idempotency (2/2 plans) — completed 2026-02-22
- [x] Phase 5: Security Test Coverage (3/3 plans) — completed 2026-02-22
- [x] Phase 6: Legacy Cleanup (2/2 plans) — completed 2026-02-23

</details>

<details>
<summary>✅ v1.0 Core Infrastructure (Phases 7-10) — SHIPPED 2026-03-21</summary>

- [x] Phase 7: Observability (3/3 plans) — completed 2026-03-21
- [x] Phase 8: Email Infrastructure & Preferences (2/2 plans) — completed 2026-03-21
- [x] Phase 9: Booking Notification Emails (1/1 plan) — completed 2026-03-21
- [x] Phase 10: Trial Lifecycle (1/1 plan) — completed 2026-03-21

</details>

<details>
<summary>✅ v1.1 Launch Readiness (Phases 11-14) — SHIPPED 2026-03-26</summary>

- [x] Phase 11: Legal Pages (2/2 plans) — completed 2026-03-22
- [x] Phase 12: Onboarding & Empty States (2/2 plans) — completed 2026-03-22
- [x] Phase 13: CSV Import & Export (2/2 plans) — completed 2026-03-22
- [x] Phase 14: Content Pages & Documentation (2/2 plans) — completed 2026-03-26

</details>

### 🚧 v1.2 Protection & Visibility (In Progress)

**Milestone Goal:** Expand booking protection with domain-level allowlisting and give users full visibility into protection activity.

- [x] **Phase 15: Domain Schema** - Add DomainEntry model and extend AuditAction enum (gating dependency for all domain features) (completed 2026-03-27)
- [x] **Phase 16: Domain API + Webhook** - Backend CRUD routes, Zod validation, tier limits, and webhook domain matching (completed 2026-03-27)
- [ ] **Phase 17: Domain UI** - Allowlist UI with domain entries, add/delete dialogs, type badges, and scope warnings
- [ ] **Phase 18: Activity Log + Cross-Feature** - Interactive activity log with filtering, pagination, search, rejection reasons, and quick-add-to-allowlist from rejected rows

## Phase Details

### Phase 15: Domain Schema
**Goal**: The database schema supports domain entries as a first-class model, enabling all subsequent domain feature work
**Depends on**: Phase 14
**Requirements**: None (infrastructure phase — enables DOM-01, DOM-02, DOM-03, DOM-04 in phases 16-17)
**Success Criteria** (what must be TRUE):
  1. Prisma migration runs cleanly on dev and staging with no changes to existing AllowlistEntry, BookingAttempt, or AuditLog data
  2. DomainEntry model exists with allowlistId foreign key, domain field (stored without @ prefix), unique constraint per allowlist, and index on domain
  3. AuditLog AuditAction enum includes ADD_DOMAIN and REMOVE_DOMAIN values
  4. TIER_LIMITS in lib/utils.ts includes a domainEntries count per tier (FREE / PRO / BUSINESS / ENTERPRISE)
**Plans**: 1 plan

Plans:
- [x] 15-01-PLAN.md — Prisma schema migration (DomainEntry model, AuditAction enum extension) and TIER_LIMITS domain entry limits

### Phase 16: Domain API + Webhook
**Goal**: Users' domain entries are checked during booking interception and can be managed via API endpoints
**Depends on**: Phase 15
**Requirements**: DOM-04
**Success Criteria** (what must be TRUE):
  1. A booking from an invitee whose email matches a domain entry (@company.com) is approved by the webhook, not cancelled
  2. Domain matching works correctly under all 5 guest-check modes (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL), including for guest emails
  3. API endpoints for creating and deleting domain entries return correct responses and enforce tier limits
  4. Invalid domain formats (bare @, @.com, uppercase, unqualified hostnames) are rejected by the API with a validation error
  5. AuditLog records are written for domain add and delete operations
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md — Domain CRUD API routes (POST + DELETE) with Zod validation, free provider blocking, tier enforcement, and audit-first logging
- [x] 16-02-PLAN.md — Webhook handler extension: domainEntries in Prisma include, allowedDomainHashes set, isEmailApproved domain check

### Phase 17: Domain UI
**Goal**: Users can manage domain entries from the allowlist page with clear visual distinction and scope awareness
**Depends on**: Phase 16
**Requirements**: DOM-01, DOM-02, DOM-03
**Success Criteria** (what must be TRUE):
  1. User can type @company.com into an add dialog and save it; the entry appears in the allowlist page
  2. User can delete a domain entry from the allowlist page and it is immediately removed from the list
  3. Domain entries appear in the allowlist UI with a visual badge or indicator that distinguishes them from email entries
  4. When adding a domain entry, a scope warning informs the user that all bookings from that domain will be approved
**Plans**: TBD

Plans:
- [ ] 17-01: DomainAllowlistSection and AddDomainDialog components
- [ ] 17-02: Domain entry display with type badges in allowlist page

### Phase 18: Activity Log + Cross-Feature
**Goal**: Users have full, interactive visibility into booking protection activity and can act on rejected bookings directly from the log
**Depends on**: Phase 16, Phase 17
**Requirements**: ACTV-01, ACTV-02, ACTV-03, ACTV-04, XFEAT-01, XFEAT-02
**Success Criteria** (what must be TRUE):
  1. User can click a status filter tab (All / Approved / Rejected / Rate Limited) and the activity log updates to show only matching rows; filter state persists in the URL
  2. User can see the rejection reason displayed on each rejected booking row
  3. User can navigate beyond the first 100 activity log entries using pagination controls
  4. User can type an email address into a search input and the activity log filters to matching rows
  5. User can click an action on a rejected booking row and add the invitee's email directly to their allowlist
  6. When adding from a rejected row, user is offered the option to add the full domain (@domain.com) instead of the individual email
**Plans**: TBD

Plans:
- [ ] 18-01: Activity log client component refactor with status filter and pagination
- [ ] 18-02: Activity log search and rejection reason display
- [ ] 18-03: Quick-add-to-allowlist modal with email/domain choice from rejected rows

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.1 | 3/3 | Complete | 2026-02-22 |
| 2. Token Security & Webhook Hardening | v0.1 | 3/3 | Complete | 2026-02-22 |
| 3. Rate Limiting | v0.1 | 2/2 | Complete | 2026-02-22 |
| 4. Audit Logging & Webhook Idempotency | v0.1 | 2/2 | Complete | 2026-02-22 |
| 5. Security Test Coverage | v0.1 | 3/3 | Complete | 2026-02-22 |
| 6. Legacy Cleanup | v0.1 | 2/2 | Complete | 2026-02-23 |
| 7. Observability | v1.0 | 3/3 | Complete | 2026-03-21 |
| 8. Email Infrastructure & Preferences | v1.0 | 2/2 | Complete | 2026-03-21 |
| 9. Booking Notification Emails | v1.0 | 1/1 | Complete | 2026-03-21 |
| 10. Trial Lifecycle | v1.0 | 1/1 | Complete | 2026-03-21 |
| 11. Legal Pages | v1.1 | 2/2 | Complete | 2026-03-22 |
| 12. Onboarding & Empty States | v1.1 | 2/2 | Complete | 2026-03-22 |
| 13. CSV Import & Export | v1.1 | 2/2 | Complete | 2026-03-22 |
| 14. Content Pages & Documentation | v1.1 | 2/2 | Complete | 2026-03-26 |
| 15. Domain Schema | v1.2 | 1/1 | Complete    | 2026-03-27 |
| 16. Domain API + Webhook | v1.2 | 2/2 | Complete    | 2026-03-27 |
| 17. Domain UI | v1.2 | 0/2 | Not started | - |
| 18. Activity Log + Cross-Feature | v1.2 | 0/3 | Not started | - |

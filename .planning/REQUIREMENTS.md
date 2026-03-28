# Requirements: Protectly

**Defined:** 2026-03-26
**Core Value:** Protect Calendly users from unauthorized bookings by automatically cancelling meetings from people not on their allowlist — reliably, with full visibility into what happened and why.

## v1.2 Requirements

Requirements for milestone v1.2 Protection & Visibility. Each maps to roadmap phases.

### Domain Allowlisting

- [x] **DOM-01**: User can add a domain entry (@company.com) to their allowlist
- [x] **DOM-02**: User can delete a domain entry from their allowlist
- [x] **DOM-03**: User can see domain entries in their allowlist UI with visual distinction from email entries
- [x] **DOM-04**: Webhook booking check matches invitee email against domain entries (including guest emails under all 5 check modes)

### Activity Log

- [x] **ACTV-01**: User can filter activity log by status (All / Approved / Rejected / Rate Limited)
- [ ] **ACTV-02**: User can see the rejection reason for rejected bookings
- [x] **ACTV-03**: User can paginate through activity log beyond 100 items
- [ ] **ACTV-04**: User can search activity log by email address

### Cross-Feature

- [ ] **XFEAT-01**: User can add a rejected booking's email to their allowlist directly from the activity log
- [ ] **XFEAT-02**: When adding from a rejected row, user can choose to add the email or the entire domain (@domain.com)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Domain Allowlisting

- **DOM-F01**: Domain coverage indicator showing how many existing email entries a new domain would cover
- **DOM-F02**: Bulk domain import via CSV
- **DOM-F03**: Per-event-type domain allowlists

### Activity Log

- **ACTV-F01**: Activity log CSV export
- **ACTV-F02**: Real-time activity feed (WebSocket)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Wildcard glob domain patterns (`*.company.com`) | Increases attack surface; exact domain match is sufficient for Protectly's threat model |
| Domain blocklist (explicit deny) | Protectly's model is allowlist-only; deny is the default for unlisted entries |
| Real-time WebSocket activity feed | Vercel serverless doesn't support persistent connections without third-party infra |
| Per-event-type domain allowlists | Global domain allowlist covers v1.2 use cases; per-event deferred to v2 |
| Bulk domain CSV import | Individual add covers 95% of use cases (most users have 1-5 corporate domains) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOM-01 | Phase 17 | Complete |
| DOM-02 | Phase 17 | Complete |
| DOM-03 | Phase 17 | Complete |
| DOM-04 | Phase 16 | Complete |
| ACTV-01 | Phase 18 | Complete |
| ACTV-02 | Phase 18 | Pending |
| ACTV-03 | Phase 18 | Complete |
| ACTV-04 | Phase 18 | Pending |
| XFEAT-01 | Phase 18 | Pending |
| XFEAT-02 | Phase 18 | Pending |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

**Note:** Phase 15 (Domain Schema) is an infrastructure phase with no direct user-facing requirements. It is the gating dependency that enables DOM-01 through DOM-04 in Phases 16-17.

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*

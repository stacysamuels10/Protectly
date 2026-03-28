---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Protection & Visibility
status: unknown
stopped_at: Phase 18 context gathered
last_updated: "2026-03-28T01:22:27.130Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Protect Calendly users from unauthorized bookings by automatically cancelling meetings from people not on their allowlist — reliably, with full visibility into what happened and why.
**Current focus:** Phase 17 — domain-ui

## Current Position

Phase: 17 (domain-ui) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity (across milestones):**

- v0.1: 13 plans, ~3 min avg
- v1.0: 7 plans, ~4 min avg
- v1.1: 8 plans
- Total: 28 plans executed

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting current work:

- [v1.2 research]: DomainEntry as separate Prisma model (not AllowlistEntry reuse) — prevents CSV/audit/validation breakage
- [v1.2 research]: Domain check extends isEmailApproved() — never a parallel branch — preserves all 5 guest-check modes
- [v1.2 research]: Activity log refactored from SSR direct Prisma call to client component using existing paginated API
- [Phase 15-domain-schema]: DomainEntry as separate Prisma model (not AllowlistEntry reuse) — prevents CSV/audit/validation breakage
- [Phase 15-domain-schema]: FREE tier gets 10 domain entries (not 0) to allow feature trial — D-07
- [Phase 16]: Domain hash checked after email hash inside isEmailApproved — single function, no parallel branch
- [Phase 16-domain-api-webhook]: Free email providers blocked with immediate 400 (not invalid array skip) per D-03 block-entirely intent
- [Phase 17-domain-ui]: type='text' input for domain field (not type='email') — allows @company.com format without browser email validation rejection
- [Phase 17-domain-ui]: ResizeObserver must be mocked as a class (not vi.fn()) for Radix UI DropdownMenu / floating-ui compatibility in jsdom

### Pending Todos

None.

### Blockers/Concerns

- [Phase 16]: Webhook handler is highest-risk change — review evaluateGuestCheckMode call site in src/lib/guest-check.ts before writing domain check
- [Gap]: approvalReason display for domain-matched approvals — decide before Phase 18 whether to reuse rejectionReason field or add new field
- [Gap]: Tier limits for domain entries need product decision before Phase 15 ships (suggested: 10 FREE / 100 PRO / 500 BUSINESS / unlimited ENTERPRISE)

## Session Continuity

Last session: 2026-03-28T01:22:27.122Z
Stopped at: Phase 18 context gathered
Resume file: .planning/phases/18-activity-log-cross-feature/18-CONTEXT.md

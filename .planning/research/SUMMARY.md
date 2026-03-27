# Project Research Summary

**Project:** Protectly v1.2 — domain allowlisting and activity log UI
**Domain:** Booking protection SaaS (Next.js 15 / Prisma / PostgreSQL)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

Protectly v1.2 adds two features to an existing, well-structured codebase: domain allowlisting (so users can approve `@company.com` rather than 100 individual emails) and an interactive activity log (status filtering, pagination, and email search on a page that currently shows a static capped list). Both features are pure schema + API + UI work. No new npm packages are required. The entire implementation draws on the stack already in production: Next.js 15 App Router, Prisma 5.7, shadcn/ui, TanStack Query v5, Zod, and date-fns.

The recommended approach is to build in dependency order: schema migration first (every domain feature is gated on it), domain API routes and webhook integration next (can proceed in parallel with each other), domain UI after the API exists, and activity log UI refactor independently (no dependency on domain allowlisting at all). The highest-risk change is the webhook handler modification — it touches core booking protection logic and must extend the existing `isEmailApproved` function rather than adding a parallel code path that bypasses the five guest-check modes.

The primary risks are architectural, not stack-related. Two anti-patterns must be actively avoided: adding a `type` discriminator to the existing `AllowlistEntry` model (which breaks all existing email CRUD, CSV import/export, and tests) and implementing the domain check as a separate branch outside `evaluateGuestCheckMode` (which silently breaks domain matching for guests in STRICT mode). Both risks are well-understood and preventable with the concrete mitigations documented in PITFALLS.md. A third risk is building the activity log filter UI on top of the existing SSR page component instead of the existing paginated API — doing so guarantees a complete rewrite later.

---

## Key Findings

### Recommended Stack

No new packages are needed. The existing stack covers every requirement: Zod handles domain format validation (a 10-character regex); Radix/shadcn covers all new UI components (dialogs, selects, tables); TanStack Query v5 handles client-side pagination and filtering; date-fns handles date arithmetic. The only infrastructure change is a Prisma migration to add the `DomainEntry` model.

**Core technologies:**
- `next` 15.1.3: App Router — RSC for initial page loads, client components for interactive filtering and pagination
- `@prisma/client` 5.7.1: New `DomainEntry` model as a sibling to `AllowlistEntry`; `AuditAction` enum extended with `ADD_DOMAIN` / `REMOVE_DOMAIN`; no existing model modified
- `@tanstack/react-query` 5.17.0: Already installed — drives activity log pagination and filter state via `useQuery` with dynamic query params
- `zod` 3.22.4: Domain format validation on API routes server-side (not client-only); regex `/^@?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i`
- shadcn/ui (Radix + Tailwind): All new dialogs, tables, tabs, and filter controls are covered by the existing installation

See `.planning/research/STACK.md` for full rationale and explicit "what NOT to add" analysis.

---

### Expected Features

**Must have (P1 — table stakes for v1.2):**
- Add / delete domain entries (`@company.com`) backed by a dedicated `DomainEntry` model (not a reuse of `AllowlistEntry.email`)
- Webhook checks domain against `DomainEntry` after exact email check fails; domain check integrated inside `isEmailApproved` so all 5 guest-check modes remain intact
- Domain entries visible in allowlist UI with a type badge distinguishing them from email entries; scope warning on add ("This approves all bookings from @company.com")
- Activity log status filter tabs (All / Approved / Rejected / Rate Limited) wired to the existing API `status` param
- Activity log pagination controls wired to the existing API `page` / `totalPages` response
- Rejection reason displayed on rejected rows (field already stored in DB, not yet rendered)

**Should have (P2 — high value, add if scope allows):**
- "Add to allowlist" action from a rejected booking row (opens modal pre-filled with email; offers domain option if domain allowlisting is complete)
- Activity log email search (requires adding `search` param to `/api/dashboard/activity`; debounced input)
- "Quick add domain" shortcut in the add-to-allowlist modal (extract domain from rejected email, present as second option alongside individual email add)

**Defer to v2+:**
- Domain coverage indicator (shows how many existing email entries a new domain would cover — useful but adds a query round-trip on every domain input)
- Bulk domain CSV import (single-add covers 95% of use cases; CSV parsing complexity is high for mixed email/domain files)
- Per-event-type domain allowlists (global domain allowlist covers all v1.2 use cases)
- Activity log CSV export (low frequency need; not core protection value)
- Wildcard glob domain patterns (`*.company.com`) — security risk; exact match is sufficient for v1.2 threat model

See `.planning/research/FEATURES.md` for full prioritization matrix, dependency graph, and anti-feature analysis.

---

### Architecture Approach

The architecture is additive: a new `DomainEntry` Prisma model with its own API routes mirrors the existing `AllowlistEntry` + `/api/allowlists/[id]/entries/` pattern exactly. The activity log page is refactored from a Server Component with a direct Prisma call (`take: 100`) into a client-component shell that fetches from the existing paginated API. The webhook handler gains one additional Prisma `include` and an extended `isEmailApproved` function. No service layer, no new infrastructure, no new npm packages.

**Major components:**
1. `DomainEntry` Prisma model — new sibling to `AllowlistEntry`; `@@unique([allowlistId, domain])`, `@@index([domain])`; domain stored without `@` prefix, displayed with `@` prefix in UI
2. `/api/allowlists/[id]/domains/` — GET + POST; `/api/allowlists/[id]/domains/[domainId]/` — DELETE; mirrors existing entries API with tier limit enforcement
3. `/api/dashboard/audit-log/` — new route exposing the existing `AuditLog` table (already populated by allowlist mutations); used by a new "Allowlist Changes" tab on the activity page
4. `DomainAllowlistSection` + `AddDomainDialog` — new client components wired into the existing allowlist page below the email table
5. `ActivityTable` + `AuditLogTable` — extracted client components replacing the SSR-only activity page; tabbed UI for "Booking Attempts" and "Allowlist Changes"
6. Webhook handler — extended with `domainEntries` include on the existing `prisma.user.findFirst` and domain suffix check inside `isEmailApproved`

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component responsibility table, and build order with dependency rationale.

---

### Critical Pitfalls

1. **Domain check bypasses `evaluateGuestCheckMode`** — Extend `isEmailApproved(email)` to return `true` on domain match; never add a parallel `isDomainApproved()` call after the mode evaluation. All 5 guest-check modes depend on `isEmailApproved` as their single input boolean.

2. **Domain entries stored in `AllowlistEntry.email` column using `@` convention** — Run the Prisma migration and add a proper `DomainEntry` model. Storing `@company.com` in the email column breaks email validation, CSV round-trips, and audit log semantics. Recovery cost is MEDIUM; migration cost is LOW. There is no acceptable reason to skip the migration.

3. **Webhook `prisma.user.findFirst` include block not updated** — After the schema migration, grep every `allowlists.entries` include in the codebase and add `domainEntries`. Missing this causes domain-matched bookings to silently reject with no error thrown.

4. **Activity log filter/pagination UI built on the SSR page component** — The page calls `prisma.bookingAttempt.findMany` with `take: 100` directly. Adding filter or pagination UI on top of this is a trap. Convert to a client component fetching `/api/dashboard/activity` which already supports `status`, `page`, `limit`, and `totalPages`.

5. **No server-side domain format validation** — Zod schema on the domain CRUD endpoint must reject `@` (protection bypass — matches any email), `@.com`, bare `company.com`, and uppercase variants. Storing `@` as a valid entry is a critical security bug.

See `.planning/research/PITFALLS.md` for the full 7-pitfall analysis with warning signs, recovery strategies, and "looks done but isn't" verification checklist.

---

## Implications for Roadmap

Based on research, the dependency graph drives a clear 4-phase build order. Domain features gate on schema; activity log is independent.

### Phase 1: Schema and Foundation

**Rationale:** Every domain feature depends on the `DomainEntry` model existing. This is the single gating dependency for the entire milestone. Must be done first so downstream phases can be developed and tested against the real schema. The activity log work can also begin here (no schema dependency, but early clarity on the SSR-vs-API decision is needed).
**Delivers:** Prisma migration (`DomainEntry` model, `AuditAction` enum extension with `ADD_DOMAIN` / `REMOVE_DOMAIN`), `TIER_LIMITS` update in `lib/utils.ts` with `domainEntries` count per tier, migration deployed to dev and staging.
**Addresses:** Domain entry storage (P1 must-have)
**Avoids:** Pitfall 2 (domain entries stored in email column — migration IS the prevention), Pitfall 5 (webhook include not updated — sets up the correct schema for Phase 2)

### Phase 2: Domain API Routes and Webhook Integration

**Rationale:** API routes can be built and tested independently before any UI exists. The webhook integration is the highest-risk change and benefits from being isolated with focused test coverage. Both sub-tasks in this phase are independent of each other and can proceed in parallel.
**Delivers:** `/api/allowlists/[id]/domains/` (GET, POST) and `/api/allowlists/[id]/domains/[domainId]/` (DELETE) with Zod validation and tier limit enforcement; webhook handler updated to include `domainEntries` in the existing `prisma.user.findFirst` and extend `isEmailApproved`; `AuditLog` records written for domain mutations.
**Addresses:** Webhook domain check (P1), domain entry CRUD backend, server-side format validation
**Avoids:** Pitfall 1 (guest-check mode bypass — extend `isEmailApproved`, do not add a parallel branch), Pitfall 3 (webhook include not updated), Pitfall 6 (no server-side validation)

### Phase 3: Domain UI

**Rationale:** Depends on Phase 2 (API routes must exist). Lower risk than the webhook change — pure UI work using established shadcn/ui component patterns already in the codebase.
**Delivers:** `DomainAllowlistSection` component, `AddDomainDialog`, domain entries visible in allowlist page with type badge, scope warning on domain add confirming breadth of approval.
**Addresses:** Domain entries visible in allowlist UI (P1), add/delete domain entry UI (P1)
**Avoids:** UX pitfall: no visual distinction between email and domain entries; UX pitfall: no scope warning before adding a broad domain entry

### Phase 4: Activity Log UI

**Rationale:** Fully independent of domain allowlisting — can run in parallel with Phases 2 and 3 or sequentially after. The activity page refactor from SSR to client component is the prerequisite for all interactive features and must happen first within this phase.
**Delivers:** Activity page converted from SSR (`take: 100` direct Prisma call removed) to a client-component shell; `ActivityTable` with status filter tabs (URL params for shareability), pagination controls, and rejection reason display; `AuditLogTable` with paginated allowlist change history; `/api/dashboard/audit-log/` route; "add to allowlist" modal from rejected rows (P2, depends on Phase 2 being complete); optional email search param added to activity API.
**Addresses:** Activity log status filter (P1), pagination (P1), rejection reason display (P1), audit log tab (architecture), "add to allowlist" action (P2), email search (P2)
**Avoids:** Pitfall 3 (SSR/API divergence); UX pitfall: filter state lost on back-navigation (use URL search params `?status=REJECTED`)

### Phase Ordering Rationale

- Phase 1 is mandatory first: zero domain features can be built without the migration.
- Phase 2 must follow Phase 1 (needs the schema), but its two sub-tracks (API routes and webhook integration) are independent of each other.
- Phase 3 must follow Phase 2 (UI needs API routes), but is otherwise independent.
- Phase 4 is fully independent of Phases 1–3 and can run in parallel. The "add to allowlist" P2 feature bridges domain and activity log and should be built last within Phase 4, after Phase 2 is confirmed stable.
- The "quick add domain" shortcut is a natural follow-on within Phase 4's "add to allowlist" modal and requires no additional dependencies.

### Research Flags

Phases with standard patterns (skip `research-phase` during planning):
- **Phase 1 (Schema):** Standard Prisma migration; additive schema change; well-documented patterns.
- **Phase 2 (Domain API):** Mirrors existing `/api/allowlists/[id]/entries/` pattern exactly; well-established in the codebase.
- **Phase 3 (Domain UI):** Follows established shadcn/ui component patterns already present in `allowlist-table.tsx` and `add-email-dialog.tsx`.
- **Phase 4 (Activity Log UI):** TanStack Query v5 + Next.js App Router client component pattern is well-documented; existing API already supports all required params.

Phases that benefit from implementation-time code review (not full research):
- **Phase 2 (Webhook integration):** The approach is clear, but the `evaluateGuestCheckMode` call site warrants a focused review of `src/lib/guest-check.ts` before writing the domain check to confirm `isEmailApproved` is the correct extension point and that all 5 mode paths are covered by tests.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Derived from direct codebase inspection of `package.json` and all relevant source files. Zero new packages; all conclusions are based on what is already installed. |
| Features | HIGH | Grounded in codebase analysis plus domain allowlisting patterns from email security tooling. P1/P2/P3 prioritization is well-reasoned against user value and implementation cost. |
| Architecture | HIGH | Derived from direct inspection of all affected files. The `DomainEntry` separate model decision is the key architectural call and is well-justified by the risk of touching existing `AllowlistEntry` code. |
| Pitfalls | HIGH | Each pitfall references the exact file and function at risk. Not speculative — identified from direct code analysis of webhook handler, guest-check modes, SSR page component, and CSV import path. |

**Overall confidence:** HIGH

### Gaps to Address

- **`approvalReason` for domain-matched bookings:** `BookingAttempt` has no `approvalReason` field. Domain-matched approvals will show no match source in the activity log unless the existing `rejectionReason` field is repurposed for both paths (no schema change) or a new `approvalReason` field is added via migration. Decide before Phase 4 implementation; reusing `rejectionReason` is acceptable for v1.2.
- **Tier limits for domain entries:** `TIER_LIMITS` in `utils.ts` needs a `domainEntries` count per tier. ARCHITECTURE.md suggests 10 FREE / 100 PRO / 500 BUSINESS / unlimited ENTERPRISE. Validate these numbers against product decisions before the Phase 1 migration ships.
- **Activity log date range filter:** The current API uses `retentionDays` (tier-based), not an explicit date range parameter. If a date picker is desired in Phase 4, it requires an API change and possibly a Radix Popover calendar component. Research treats this as optional; confirm scope before Phase 4 planning.
- **CSV import and domain entries:** PITFALLS.md flags that the existing CSV import pipeline will silently drop `@domain.com` rows. If CSV import for domain entries is in scope for v1.2, it must be updated in the same phase as the `DomainEntry` model. This is currently deferred to v2+ per FEATURES.md — confirm this decision before Phase 1.

---

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` — model definitions, relations, enum values (direct inspection, 2026-03-26)
- `src/app/api/webhooks/calendly/route.ts` — webhook handler, `isEmailApproved`, allowlist include block (direct inspection)
- `src/lib/guest-check.ts` — `evaluateGuestCheckMode` interface and all 5 mode implementations (direct inspection)
- `src/app/api/dashboard/activity/route.ts` — existing paginated API with status filter (direct inspection)
- `src/app/(dashboard)/dashboard/activity/page.tsx` — SSR direct Prisma query with `take: 100` (direct inspection)
- `src/app/(dashboard)/dashboard/allowlist/page.tsx` — existing allowlist UI patterns (direct inspection)
- `src/app/api/allowlists/[id]/entries/route.ts` — AuditLog write pattern and ownership check (direct inspection)
- `src/lib/utils.ts` — `TIER_LIMITS` structure (direct inspection)
- `package.json` — installed package versions (direct inspection)

### Secondary (MEDIUM confidence)
- Mimecast wildcard policies documentation — informed the anti-feature decision to exclude glob patterns (`*.company.com`)
- Audit Logging Best Practices (Sonar) — corroborated AuditLog design decisions for domain mutations
- SaaS Bulk Actions UX (Eleken) — informed bulk domain import deferral decision
- Guide to Building Audit Logs for Application Software (Infisical/Medium) — corroborated `targetEmail` dual-use convention

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*

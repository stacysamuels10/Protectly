# Phase 18: Activity Log + Cross-Feature - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the activity log page from SSR to an interactive client component with status filtering, email search, pagination, rejection reason display, and quick-add-to-allowlist from rejected rows. Users get full, interactive visibility into booking protection activity and can act on rejected bookings directly from the log.

</domain>

<decisions>
## Implementation Decisions

### Filter & search UX
- **D-01:** Status filter as horizontal pill tabs (All / Approved / Rejected / Rate Limited) with count badges on each tab, displayed above the activity table
- **D-02:** Search input positioned beside filter tabs on the same row (tabs left, search right) — compact single-row toolbar
- **D-03:** Debounced live search (300ms debounce) filtering by invitee email — no submit button needed
- **D-04:** Filter status, search query, and page number all persisted as URL search params (`?status=REJECTED&q=john&page=2`) — shareable, survives refresh

### Rejection reason display
- **D-05:** Rejection reason shown as inline muted subtitle text below the email/name line on rejected rows — always visible, no click needed (e.g. "Reason: Not on allowlist")
- **D-06:** Approved rows do NOT show approval reasons — approvals are the expected outcome, no explanation needed

### Pagination
- **D-07:** Classic numbered page pagination at bottom of table (< 1 2 3 ... 10 >) with "Showing X-Y of Z" count
- **D-08:** 25 items per page (matches existing API default)

### Quick-add-to-allowlist
- **D-09:** Inline "Add to allowlist" button with dropdown chevron on each rejected row — only visible on rejected status rows
- **D-10:** Dropdown offers two choices: "Add email (user@bad.com)" or "Add domain (@bad.com)" — fulfills XFEAT-02
- **D-11:** On success: toast notification ("Added user@bad.com to allowlist") and button changes to "Added" (disabled state). Row stays in place.
- **D-12:** Uses existing POST `/api/allowlists/[id]/entries/` for email adds and POST `/api/allowlists/[id]/domains/` for domain adds

### Claude's Discretion
- Loading skeleton/spinner design while fetching data
- Exact debounce implementation (useCallback + setTimeout vs lodash debounce vs useDeferredValue)
- Responsive layout adjustments for mobile (tabs may wrap to second row)
- Empty state for filtered views with no results vs overall empty state
- Toast library choice (existing pattern or new)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Activity log (existing implementation to refactor)
- `src/app/(dashboard)/dashboard/activity/page.tsx` — Current SSR implementation with stats cards and attempt list; refactor target
- `src/app/api/dashboard/activity/route.ts` — Existing paginated API with status filter, page/limit params, returns rejectionReason

### Allowlist APIs (for cross-feature add)
- `src/app/api/allowlists/[id]/entries/route.ts` — POST endpoint for adding email entries (Zod, ownership, tier check, audit-first)
- `src/app/api/allowlists/[id]/domains/route.ts` — POST endpoint for adding domain entries (same patterns)

### Schema
- `prisma/schema.prisma` — BookingAttempt model (lines 173-193): inviteeEmail, inviteeName, status, rejectionReason, eventType relation
- `src/lib/utils.ts` — TIER_LIMITS with activityLogDays retention, formatDateTime helper

### UI components
- `src/components/ui/badge.tsx` — Badge component with success/error/warning variants (used for status badges)
- `src/components/ui/card.tsx` — Card/CardContent/CardHeader used in current layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Badge component with success/error/warning variants — already used for status badges in current page
- Card component — wraps the activity table
- `formatDateTime` utility — already used for timestamp display
- Stats cards (Approved/Rejected/Rate Limited counts) — keep these, they work well
- Activity API already returns `rejectionReason` in response — no backend changes needed for ACTV-02

### Established Patterns
- Dashboard pages use server components with Prisma — this phase breaks the pattern by moving to client component + API fetch
- API routes use `getCurrentUser()` for auth, Zod for validation, Prisma for data
- Allowlist entry/domain POST routes follow audit-first pattern with PostHog tracking
- URL state management: no existing pattern in the codebase — this will establish one (useSearchParams from next/navigation)

### Integration Points
- Activity page route stays at `dashboard/activity/page.tsx` — becomes a thin server wrapper that renders the client component
- API endpoint at `/api/dashboard/activity` — may need `search` query param added for ACTV-04
- Allowlist APIs need the user's allowlist ID — fetch from session or API
- Sidebar nav already links to `/dashboard/activity` — no navigation changes needed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-activity-log-cross-feature*
*Context gathered: 2026-03-27*

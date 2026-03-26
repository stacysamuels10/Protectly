# Phase 13: CSV Import & Export - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add CSV import (Pro+ gated) and CSV export (all users) to the allowlist page. Import includes client-side parsing, email validation, duplicate skipping, progress indicator, and batch API calls. Export downloads all entries as a dated CSV file.

</domain>

<decisions>
## Implementation Decisions

### Import UX
- **D-01:** "Import CSV" button on allowlist page opens native file picker. No drag-and-drop.
- **D-02:** Import results shown as summary toast ("Added 47, skipped 3 duplicates, 2 invalid") plus inline error list for invalid rows.
- **D-03:** Progress indicator shown during processing (for large files).

### Export Format
- **D-04:** Export includes all entries regardless of search/filter state. Four columns: email, name, notes, dateAdded.
- **D-05:** Filename format: `prical-allowlist-YYYY-MM-DD.csv`

### Tier Gating
- **D-06:** Import button visible to all users. Free users clicking it see an upgrade prompt ("CSV import is a Pro feature — Upgrade to Pro"). Shows value of upgrading.
- **D-07:** Export available to all users — no tier restriction. It's their data.

### Claude's Discretion
- CSV parsing library choice (papaparse or native)
- Batch size for API calls (GitHub issue suggests 50 at a time)
- Client-side vs server-side parsing approach
- Progress indicator component (progress bar vs spinner with count)
- Error report format (which columns shown for invalid rows)
- Whether import creates a new API route or uses existing allowlist endpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Allowlist UI (primary integration point)
- `src/app/(dashboard)/dashboard/allowlist/page.tsx` — Allowlist page
- `src/components/dashboard/allowlist-table.tsx` — Table component where import/export buttons go
- `src/app/api/allowlists/[id]/entries/route.ts` — Existing POST endpoint for adding entries

### Tier logic
- `src/lib/utils.ts` — TIER_LIMITS constants
- `src/components/dashboard/subscription-card.tsx` — Existing upgrade prompt pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — Button component for Import/Export buttons
- `src/components/ui/dialog.tsx` — Dialog for upgrade prompt
- `src/components/dashboard/allowlist-table.tsx` — Table where buttons are added
- `src/lib/utils.ts` — TIER_LIMITS for tier checking
- Existing toast system — for import result notifications

### Established Patterns
- Allowlist entries created via POST to `/api/allowlists/[id]/entries`
- Tier checking via `user.subscriptionTier` comparison
- Client Components for interactive features (`'use client'`)
- Server Components for data loading

### Integration Points
- Allowlist page header area — add Import CSV and Export CSV buttons
- New API route for import (batch processing) or reuse existing entries endpoint
- New API route for export (GET that returns CSV content-type)
- Tier gate check before import processing

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard CSV import/export patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-csv-import-export*
*Context gathered: 2026-03-22*

# Phase 18: Activity Log + Cross-Feature - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 18-activity-log-cross-feature
**Areas discussed:** Filter & search UX, Rejection reason display, Pagination style, Quick-add-to-allowlist flow

---

## Filter & Search UX

### Status filter tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Pill tabs above the table | All / Approved / Rejected / Rate Limited as horizontal pill buttons with count badges | ✓ |
| Dropdown select | Single dropdown with status options — compact, less visual | |
| Segmented control | iOS-style segmented toggle — more prominent | |

**User's choice:** Pill tabs above the table
**Notes:** Matches existing Badge component style

### Search behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced live search | Search as you type with 300ms debounce, no submit button | ✓ |
| Submit-on-enter search | Search with button or enter-to-submit | |
| You decide | Claude picks | |

**User's choice:** Debounced live search

### URL state persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, URL params | Filter, search, page stored as URL search params | ✓ |
| No, component state only | Simpler but resets on refresh | |

**User's choice:** URL params

### Search input placement

| Option | Description | Selected |
|--------|-------------|----------|
| Search beside tabs | Tabs left, search right — same row | ✓ |
| Search below tabs | Separate row below tabs | |

**User's choice:** Search beside tabs

---

## Rejection Reason Display

### Display style

| Option | Description | Selected |
|--------|-------------|----------|
| Inline subtitle text | Muted text below email/name line — always visible | ✓ |
| Expandable row detail | Click to expand and see reason | |
| Tooltip on hover | Hover badge to see reason — not mobile-friendly | |

**User's choice:** Inline subtitle text

### Approval reasons

| Option | Description | Selected |
|--------|-------------|----------|
| No, only rejections | Approved rows stay clean | ✓ |
| Yes, show approval reason too | More informative but busier, needs schema change | |

**User's choice:** Only show rejection reasons

---

## Pagination Style

### Pagination type

| Option | Description | Selected |
|--------|-------------|----------|
| Page numbers | Classic numbered pagination with total count | ✓ |
| Load more button | Appends next page, no jumping | |
| Infinite scroll | Auto-loads on scroll | |

**User's choice:** Page numbers

### Items per page

| Option | Description | Selected |
|--------|-------------|----------|
| 25 per page | Matches existing API default | ✓ |
| 50 per page | More data per page | |
| You decide | Claude picks | |

**User's choice:** 25 per page

---

## Quick-Add-to-Allowlist Flow

### Action placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline action button | Small button on right side of rejected rows | ✓ |
| Row click opens detail panel | Click row for side panel with action | |
| Three-dot menu | Menu with add option — less discoverable | |

**User's choice:** Inline action button

### Email vs domain choice (XFEAT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown on add button | Button has dropdown: "Add email" or "Add domain" | ✓ |
| Confirmation modal | Modal with radio buttons for email/domain choice | |
| Always add email, domain via separate button | Default adds email, separate link for domain | |

**User's choice:** Dropdown on add button

### After adding successfully

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + disable button | Success toast, button changes to "Added ✓" | ✓ |
| Toast + remove row | Success toast, fade out the row | |
| You decide | Claude picks | |

**User's choice:** Toast notification + disable button

---

## Claude's Discretion

- Loading skeleton/spinner design
- Debounce implementation approach
- Responsive mobile layout adjustments
- Empty state for filtered vs overall empty views
- Toast library choice

## Deferred Ideas

None — discussion stayed within phase scope.

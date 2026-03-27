---
phase: 17-domain-ui
plan: 01
subsystem: ui
tags: [react, radix-ui, lucide-react, vitest, testing-library]

# Dependency graph
requires:
  - phase: 16-domain-api-webhook
    provides: POST /api/allowlists/{id}/domains and DELETE /api/allowlists/{id}/domains/{domainId} endpoints
provides:
  - AddDomainDialog client component (dialog with scope warning, text input, POST fetch, all response handling)
  - DomainAllowlistSection client component (domain table with Globe, @-prefix, Domain badge, delete, empty state)
  - Unit tests for both components (19 tests total)
affects: [17-02-domain-page-wire, future domain UI consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD component build pattern (test-first, then implementation)
    - ResizeObserver class mock for Radix UI DropdownMenu in jsdom
    - globalThis.confirm mock pattern for window.confirm in vitest

key-files:
  created:
    - src/components/dashboard/add-domain-dialog.tsx
    - src/components/dashboard/add-domain-dialog.test.tsx
    - src/components/dashboard/domain-allowlist-section.tsx
    - src/components/dashboard/domain-allowlist-section.test.tsx
  modified: []

key-decisions:
  - "type='text' input (not type='email') for domain field — allows @company.com input format without browser email validation"
  - "ResizeObserver class mock required (not vi.fn()) for Radix UI DropdownMenu / floating-ui to work in jsdom"
  - "globalThis.confirm mock (not vi.spyOn) required since window.confirm is undefined in jsdom"

patterns-established:
  - "ResizeObserver mock: use class syntax in test file (not vi.fn()) for Radix floating-ui compatibility"
  - "Scope warning amber styling: bg-amber-50 border-amber-200 text-amber-800 with AlertTriangle icon"

requirements-completed: [DOM-01, DOM-02, DOM-03]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 17 Plan 01: Domain UI Components Summary

**AddDomainDialog (POST to /api/allowlists/{id}/domains) and DomainAllowlistSection (domain table with Globe icon, Domain badge, delete) — two new client components with 19 passing unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T12:42:28Z
- **Completed:** 2026-03-27T12:45:30Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments

- AddDomainDialog: dialog with scope warning (amber, AlertTriangle), text input, POST /api/allowlists/{id}/domains, handles success/duplicate/invalid/error responses via toast
- DomainAllowlistSection: table with Globe icon, @-prefixed domain names, Domain badge (variant=secondary), DropdownMenu delete, empty state with inline AddDomainDialog, footer count
- 19 unit tests passing across both components (TDD: RED then GREEN)

## Task Commits

1. **Task 1: AddDomainDialog component and tests** - `bfd4256` (feat)
2. **Task 2: DomainAllowlistSection component and tests** - `e3ffb2b` (feat)

## Files Created/Modified

- `src/components/dashboard/add-domain-dialog.tsx` - Dialog trigger + form for adding domain entries; submits POST with { domains: [domain] }
- `src/components/dashboard/add-domain-dialog.test.tsx` - 10 unit tests covering render, open/close, submit, all response variants, loading state, input type
- `src/components/dashboard/domain-allowlist-section.tsx` - Table of domain entries with Globe, @-prefix, Domain badge, DropdownMenu delete, empty state, footer count
- `src/components/dashboard/domain-allowlist-section.test.tsx` - 9 unit tests covering empty state, table rendering, badges, delete flow, footer count, aria-labels

## Decisions Made

- `type="text"` on domain input (not `type="email"`) — domain input needs to accept @company.com format without browser email validation rejecting it
- ResizeObserver must be mocked as a class (not `vi.fn()`) for Radix UI DropdownMenu / floating-ui to work in jsdom
- `globalThis.confirm = vi.fn()` pattern (not `vi.spyOn(window, 'confirm')`) since window.confirm is undefined in jsdom environment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ResizeObserver mock incompatibility with Radix DropdownMenu**
- **Found during:** Task 2 (DomainAllowlistSection tests)
- **Issue:** `global.ResizeObserver = vi.fn().mockImplementation(...)` from setup.ts is not a constructor — floating-ui throws "is not a constructor" when DropdownMenu opens
- **Fix:** Added `global.ResizeObserver = class ResizeObserver { observe(){} unobserve(){} disconnect(){} }` at top of domain-allowlist-section.test.tsx
- **Files modified:** src/components/dashboard/domain-allowlist-section.test.tsx
- **Verification:** Tests 6 and 7 (DropdownMenu open + delete) now pass
- **Committed in:** e3ffb2b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed vi.spyOn(window, 'confirm') fails — window.confirm undefined in jsdom**
- **Found during:** Task 2 (DomainAllowlistSection tests)
- **Issue:** `vi.spyOn(window, 'confirm')` throws "can only spy on a function, received undefined"
- **Fix:** Changed to `globalThis.confirm = vi.fn().mockReturnValue(true)`
- **Files modified:** src/components/dashboard/domain-allowlist-section.test.tsx
- **Verification:** All 9 tests pass including delete confirm flow
- **Committed in:** e3ffb2b (Task 2 commit)

**3. [Rule 1 - Bug] Fixed Test 4 false positive — table header "Domain" matched Badge count**
- **Found during:** Task 2 (DomainAllowlistSection tests)
- **Issue:** `getAllByText('Domain')` returned 4 elements (1 `<th>` + 3 badges) instead of 3
- **Fix:** Filter out `<th>` elements from results: `allDomainText.filter((el) => el.tagName !== 'TH')`
- **Files modified:** src/components/dashboard/domain-allowlist-section.test.tsx
- **Verification:** Test 4 passes with correct count 3
- **Committed in:** e3ffb2b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (Rule 1 bugs — all in test file adjustments for jsdom environment)
**Impact on plan:** All fixes were test environment compatibility issues (jsdom vs browser). No component code changes required.

## Issues Encountered

None in component code — all issues were jsdom test environment compatibility (ResizeObserver constructor, window.confirm).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both components ready to be wired into the allowlist page in Plan 02
- AddDomainDialog accepts `allowlistId: string` prop
- DomainAllowlistSection accepts `domainEntries: DomainEntry[]` and `allowlistId: string` props
- Both export named functions matching the filenames

---
*Phase: 17-domain-ui*
*Completed: 2026-03-27*

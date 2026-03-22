---
phase: 11-legal-pages
plan: 02
subsystem: ui
tags: [next.js, legal, footer, terms, privacy, stripe]

# Dependency graph
requires:
  - phase: 11-01
    provides: /privacy and /terms pages exist as valid routes

provides:
  - Landing page footer links pointing to /privacy and /terms (not placeholder #)
  - Landing page hero CTA signup legal reference text with links
  - Dashboard layout footer with Privacy and Terms links on all dashboard pages
  - Subscription upgrade card legal reference text near checkout buttons

affects:
  - any future onboarding or signup flow work (legal references already in place)
  - any future dashboard layout changes (footer pattern established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legal reference text pattern: 'By [action], you agree to our Terms of Service and Privacy Policy' with underline links"
    - "Dashboard footer inside lg:pl-64 wrapper (not under sidebar)"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/app/(dashboard)/layout.tsx
    - src/components/dashboard/subscription-card.tsx

key-decisions:
  - "No checkbox required for legal agreement — visible reference text reduces friction while meeting compliance intent"
  - "Dashboard footer placed inside lg:pl-64 wrapper so it appears in main content area, not beneath sidebar"

patterns-established:
  - "Legal agreement text near action buttons: inline paragraph below CTA buttons, not a modal or checkbox"

requirements-completed:
  - LEGAL-03

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 11 Plan 02: Legal Page Integration Summary

**Footer links and pre-action legal agreement text wired to /privacy and /terms across landing page, dashboard layout, and subscription upgrade card**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T00:04:00Z
- **Completed:** 2026-03-22T00:05:10Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Landing page footer placeholder `href="#"` links replaced with real `/privacy` and `/terms` routes
- "By signing up" legal agreement text with links added below hero CTA buttons
- Dashboard layout now has a footer (copyright + Privacy/Terms links) visible on every dashboard page
- Subscription upgrade card shows "By upgrading" legal agreement text below plan grid, visible to free and trialing users

## Task Commits

Each task was committed atomically:

1. **Task 1: Update landing page footer links and add legal reference to signup CTAs** - `d3ab13c` (feat)
2. **Task 2: Add footer with legal links to dashboard layout** - `675bdfc` (feat)
3. **Task 3: Add legal reference text to subscription upgrade card** - `e4ddd1d` (feat)

## Files Created/Modified
- `src/app/page.tsx` - Footer links updated to /privacy and /terms; "By signing up" text added after 14-day trial paragraph
- `src/app/(dashboard)/layout.tsx` - Added `import Link` and footer element after `</main>` inside lg:pl-64 wrapper
- `src/components/dashboard/subscription-card.tsx` - Added `import Link` and "By upgrading" legal text after plan grid

## Decisions Made
- No checkbox required — visible reference text below CTA buttons meets compliance intent without adding friction. Consistent with context decisions from plan.
- Dashboard footer positioned inside `lg:pl-64` wrapper so it appears under main content, not under the sidebar on larger screens.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Legal integration complete for phase 11. Both /privacy and /terms pages exist (11-01) and all key entry points now link to them (11-02).
- Phase 11 is fully complete. Next milestone work can proceed.

---
*Phase: 11-legal-pages*
*Completed: 2026-03-22*

## Self-Check: PASSED

- FOUND: src/app/page.tsx
- FOUND: src/app/(dashboard)/layout.tsx
- FOUND: src/components/dashboard/subscription-card.tsx
- FOUND: .planning/phases/11-legal-pages/11-02-SUMMARY.md
- FOUND commit: d3ab13c (Task 1)
- FOUND commit: 675bdfc (Task 2)
- FOUND commit: e4ddd1d (Task 3)

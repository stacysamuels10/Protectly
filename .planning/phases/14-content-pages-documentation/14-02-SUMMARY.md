---
phase: 14-content-pages-documentation
plan: "02"
subsystem: ui
tags: [help-center, accordion, navigation, onboarding, documentation]
dependency_graph:
  requires: []
  provides: [/help page, accordion component, help/compare nav links]
  affects: [landing page, dashboard footer, privacy page, terms page]
tech_stack:
  added: ["@radix-ui/react-accordion"]
  patterns: [shadcn accordion component, Radix primitive wrapping, forwardRef]
key_files:
  created:
    - src/components/ui/accordion.tsx
    - src/app/help/page.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/page.tsx
    - src/app/privacy/page.tsx
    - src/app/terms/page.tsx
decisions:
  - "Used Accordion type=multiple so users can open multiple FAQ items simultaneously"
  - "Help page is a server component — accordion.tsx has 'use client' but the page itself does not need it"
  - "Nav bar uses <a> tags for Sign In/Get Started (Calendly OAuth endpoint) per existing landing page pattern"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-26"
  tasks_completed: 3
  files_changed: 6
---

# Phase 14 Plan 02: Help Center Page and Navigation Links Summary

## One-Liner

Radix accordion-based help center at /help with 18 FAQ items across four sections (Getting Started with beta guide, How-To Guides, Pricing FAQ, Troubleshooting), plus /help and /compare links added to all app navigation and footers.

## What Was Built

### Task 1: Radix Accordion Component (commit: `7121170`)

Installed `@radix-ui/react-accordion` and created `src/components/ui/accordion.tsx` as a standard shadcn/ui accordion component following the exact pattern of `dialog.tsx` (forwardRef, cn utility, Radix primitive wrapping). Exports:

- `Accordion` — `AccordionPrimitive.Root`
- `AccordionItem` — adds `border-b` class
- `AccordionTrigger` — wraps inside Header, ChevronDown rotates on open via `[&[data-state=open]>svg]:rotate-180`
- `AccordionContent` — overflow-hidden with accordion animation classes

### Task 2: /help Page (commit: `3563ac8`)

Created `src/app/help/page.tsx` as a Next.js server component with four accordion sections:

1. **Getting Started** (ONBOARD-03 beta guide) — What is PriCal, setup steps with webhook URL, known limitations list, feedback channel
2. **How-To Guides** — Allowlist management, CSV import/export, notification settings, webhook setup
3. **Pricing FAQ** — Free plan, trial, subscription management, payment methods
4. **Troubleshooting** — Bookings not screened, cancelled bookings, email notifications, CSV import failure

Total of 18 AccordionTrigger items. All sections use `type="multiple"` to allow opening multiple items at once.

### Task 3: Navigation Links (commit: `c8d268b`)

Added `/help` and `/compare` links across all four app navigation areas:

| Location | Change |
|----------|--------|
| Dashboard footer (`layout.tsx`) | Help + Compare before Privacy/Terms |
| Landing page nav (`page.tsx`) | Help link before Sign In button |
| Landing page footer | Help + Compare before Privacy/Terms/Contact |
| Privacy page footer | Help + Compare before Privacy/Terms/Contact |
| Terms page footer | Help + Compare before Privacy/Terms/Contact |

## Decisions Made

1. **Accordion type="multiple"** — Users can expand multiple FAQ sections simultaneously, which is better UX for a help center where users might cross-reference answers.
2. **Server component for help page** — The accordion is a client component (`'use client'`) but the page itself requires no client-side state, so HelpPage is a server component.
3. **Nav `<a>` tags preserved** — The Sign In/Get Started buttons in the nav use `<a>` tags pointing to `/api/auth/calendly` (Calendly OAuth endpoint). This is the existing pattern in the landing page and is intentional — not a Next.js Link because it's an OAuth redirect.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all content is real and wired. The /compare link in navigation points to `/compare` which has its own page (created in plan 14-01 or parallel plan). No stub content exists on the help page.

## Verification

- `next build` completes without errors — confirmed
- `/help` route appears as static route `○` in build output
- 19 occurrences of `AccordionTrigger` in help/page.tsx (18 items + import line)
- "known limitation" text confirmed in help/page.tsx
- All 4 navigation files contain `/help` and `/compare` links

## Self-Check: PASSED

Files confirmed:
- `src/components/ui/accordion.tsx` — exists
- `src/app/help/page.tsx` — exists
- `src/app/(dashboard)/layout.tsx` — modified with /help and /compare
- `src/app/page.tsx` — modified with /help nav and footer links
- `src/app/privacy/page.tsx` — modified with /help and /compare footer
- `src/app/terms/page.tsx` — modified with /help and /compare footer

Commits confirmed:
- `7121170` — accordion component
- `3563ac8` — help page
- `c8d268b` — navigation links

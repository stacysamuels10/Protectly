---
phase: 11-legal-pages
plan: 01
subsystem: ui
tags: [next.js, legal, privacy, terms, tailwind]

# Dependency graph
requires: []
provides:
  - Privacy Policy page at /privacy with full GDPR/CCPA disclosures and third-party service list
  - Terms of Service page at /terms with pricing, cancellation, liability, and dispute resolution
affects: [legal-pages, landing-page, onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [standalone public Next.js page with nav+prose+footer layout pattern]

key-files:
  created:
    - src/app/privacy/page.tsx
    - src/app/terms/page.tsx
  modified: []

key-decisions:
  - "Standalone pages (no shared layout wrapper) for simplicity — each legal page imports its own nav and footer"
  - "Server component (no 'use client') — no interactive elements needed, avoids bundle overhead"

patterns-established:
  - "Legal page pattern: nav (border-b + Shield logo) + container prose max-w-3xl + footer (border-t)"

requirements-completed: [LEGAL-01, LEGAL-02]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 11 Plan 01: Legal Pages Summary

**Privacy Policy and Terms of Service as standalone public Next.js pages matching landing page visual style, covering all PriCal data practices, third-party services, pricing, and dispute resolution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T00:00:55Z
- **Completed:** 2026-03-22T00:02:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Privacy Policy at /privacy covering: AES-256-GCM token encryption, Calendly/Stripe/PostHog/Sentry/Resend/Vercel/Upstash third-party disclosures, GDPR/CCPA user rights (access, deletion, export, opt-out), data retention by tier (30/90/365 days), and cookie disclosure
- Terms of Service at /terms covering: service description, account terms, subscription tiers with pricing ($9/mo Pro, $29/mo Business), 14-day trial, cancellation/refund policy, limitation of liability, intellectual property, dispute resolution with class action waiver
- Both pages match landing page visual style: identical nav bar (Shield logo, Sign In/Get Started buttons), prose-formatted content (max-w-3xl mx-auto), identical footer with privacy/terms links

## Task Commits

1. **Task 1: Create Privacy Policy page at /privacy** - `bc1b576` (feat)
2. **Task 2: Create Terms of Service page at /terms** - `1728cda` (feat)

## Files Created/Modified

- `src/app/privacy/page.tsx` - Public Privacy Policy page with full legal content, nav, and footer
- `src/app/terms/page.tsx` - Public Terms of Service page with full legal content, nav, and footer

## Decisions Made

- Standalone pages with self-contained nav and footer rather than a shared layout wrapper — keeps the legal pages simple, avoids coupling to the main layout which has auth guards
- Server components only — no interactive elements needed, avoids unnecessary client-side bundle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Legal pages are live at /privacy and /terms via Next.js file-based routing
- Footer links in landing page (page.tsx) currently point to "#" — plan 11-02 or a follow-up should update them to point to /privacy and /terms

---
*Phase: 11-legal-pages*
*Completed: 2026-03-22*

## Self-Check: PASSED

- FOUND: src/app/privacy/page.tsx
- FOUND: src/app/terms/page.tsx
- FOUND: .planning/phases/11-legal-pages/11-01-SUMMARY.md
- FOUND commit bc1b576: feat(11-01): add Privacy Policy page at /privacy
- FOUND commit 1728cda: feat(11-01): add Terms of Service page at /terms

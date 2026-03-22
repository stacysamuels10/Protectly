# Phase 12: Onboarding & Empty States - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a multi-step onboarding wizard for first-time users and improve empty states on dashboard, allowlist, and activity pages. No new data features — this is pure UX improvement.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Flow Structure
- **D-01:** Multi-step wizard overlay (modal/dialog) on the dashboard. User stays in app context, not a separate route.
- **D-02:** Three steps: 1) Welcome + what PriCal does, 2) Add your first email to allowlist, 3) Protection is active — here's your dashboard.
- **D-03:** Skippable with a "Skip for now" link on each step.

### Empty State Design
- **D-04:** Icon + text + CTA pattern. Lucide icon (matching existing UI), 1-2 line explanation, primary action button. Consistent with settings card style.
- **D-05:** Helpful and encouraging tone. Example: "No emails yet — add your first approved contact to start protecting your calendar."

### Onboarding Completion Tracking
- **D-06:** Boolean `onboardingCompleted` field on User model (database, not localStorage). Persists across devices/sessions. Prisma migration needed.
- **D-07:** No replay option. One-time flow. Help center (Phase 14) covers ongoing guidance.

### Claude's Discretion
- Exact wizard component implementation (Radix Dialog or custom overlay)
- Step indicator design (dots, numbers, progress bar)
- Empty state icon choices per page
- Exact copy for each empty state and onboarding step
- Animation/transition between wizard steps
- Whether Step 2 (add email) actually submits an email or is informational

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard pages (empty state targets)
- `src/app/(dashboard)/dashboard/page.tsx` — Main dashboard page
- `src/app/(dashboard)/dashboard/allowlist/page.tsx` — Allowlist page
- `src/app/(dashboard)/dashboard/activity/page.tsx` — Activity log page

### UI patterns
- `src/components/ui/` — Existing Radix UI primitives (dialog, card, button)
- `src/components/dashboard/` — Dashboard-specific components
- `prisma/schema.prisma` — User model for onboardingCompleted field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/dialog.tsx` — Radix Dialog for wizard overlay
- `src/components/ui/button.tsx` — Button component for CTAs
- `src/components/ui/card.tsx` — Card for empty state containers
- Lucide icons (lucide-react) — already used throughout dashboard
- `src/lib/session.ts` — getCurrentUser() for checking onboardingCompleted

### Established Patterns
- Dashboard pages use Server Components with `getCurrentUser()` for data loading
- Client Components marked `'use client'` for interactive forms
- Settings page Card pattern (icon + title + description + content) for consistent UI
- PostHog tracking for key events — onboarding completion should be tracked

### Integration Points
- Dashboard layout or page — render onboarding wizard when `!user.onboardingCompleted`
- Prisma migration — add `onboardingCompleted Boolean @default(false)` to User
- `getCurrentUser()` select — add `onboardingCompleted` field
- Dashboard page, allowlist page, activity page — add empty state conditionals
- PostHog — track `onboarding_completed` and `onboarding_skipped` events

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard onboarding wizard and empty state patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-onboarding-empty-states*
*Context gathered: 2026-03-21*

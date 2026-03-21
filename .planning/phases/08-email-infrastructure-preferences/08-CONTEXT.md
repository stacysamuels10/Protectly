# Phase 8: Email Infrastructure & Preferences - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up Resend email service with React Email templates for all 5 notification types, and add email notification preference toggles to the existing settings page. This phase builds the email infrastructure and user controls — actual email sending from webhook handlers is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Email Template Design
- **D-01:** Clean minimal style — white background, single-column, no heavy branding. Like Stripe or Linear notification emails.
- **D-02:** Tone is warm and professional — not stiff corporate, not overly casual. Helpful and clear. Example: "A booking from john@example.com was cancelled — they weren't on your allowlist. You can add them with one click if this was someone you expected."
- **D-03:** BookingRejected email shows the specific rejection reason (not on allowlist, unapproved guest, guest check mode) so the user can decide whether to add the person.

### Email Preferences UX
- **D-04:** Three separate per-type toggles on the settings page:
  - Approved booking notifications (default: ON)
  - Rejected booking notifications (default: ON)
  - Trial warning notifications (default: ON)
- **D-05:** Email preferences card placed after Guest Checking card on the settings page, before Cancel Message and Delete Account.

### Sender Identity
- **D-06:** From name: "PriCal Notifications"
- **D-07:** From address: notifications@prical.io
- **D-08:** Resend domain verification required on prical.io before production sends (24-48h DNS propagation).

### Claude's Discretion
- React Email component structure and shared layout
- Exact email subject lines for each template
- Toggle component implementation (Switch from Radix UI or custom)
- Reply-to address configuration
- Email preview text (inbox snippet)
- Exact Prisma migration column names for email preferences

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Email research
- `.planning/research/STACK.md` — Resend package version, React Email setup, integration pattern
- `.planning/research/ARCHITECTURE.md` — Email infrastructure integration points, template structure
- `.planning/research/PITFALLS.md` — Resend domain verification timing, template rendering gotchas

### Existing UI patterns
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Settings page layout with Card components
- `src/components/dashboard/guest-check-form.tsx` — Existing settings form pattern with toggle-like controls
- `src/components/ui/card.tsx` — Card component used throughout settings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/card.tsx` — Card, CardContent, CardDescription, CardHeader, CardTitle used in settings
- `src/components/ui/` — Radix UI primitives available (dialog, dropdown, label, badge, etc.)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/env.ts` — Zod env validation; RESEND_API_KEY and EMAIL_FROM should be added here

### Established Patterns
- Settings page uses Server Component with `getCurrentUser()` for data loading
- Form components are Client Components (`'use client'`) that call API routes
- API routes use `getCurrentUser()` for auth, return NextResponse.json()
- Prisma schema at `prisma/schema.prisma` — User model has existing fields, needs email preference booleans
- `trialEndsAt` field already exists on User model (needed for Phase 10)

### Integration Points
- Settings page: add email preferences Card after Guest Checking section
- API route: new `/api/settings/email-preferences` endpoint (GET + PATCH)
- Prisma migration: add 3 boolean columns to User model
- Email utility: new `src/lib/email.ts` for Resend client singleton
- Email templates: new `src/emails/` directory with React Email components
- Env vars: RESEND_API_KEY, EMAIL_FROM in env.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing settings page patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-email-infrastructure-preferences*
*Context gathered: 2026-03-21*

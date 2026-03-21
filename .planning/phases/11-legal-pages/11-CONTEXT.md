# Phase 11: Legal Pages - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create Privacy Policy and Terms of Service as standalone pages at /privacy and /terms. Add footer links on all pages. Add legal references in signup/checkout flow. No new UI components beyond the pages themselves.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (user selected "You decide on all")
- Legal content: Write substantive legal text covering PriCal's actual data practices (Calendly OAuth tokens, booking data, Stripe payments, PostHog analytics, Sentry error monitoring). Not placeholder lorem ipsum, but not lawyer-reviewed either — good-faith coverage of GDPR/CCPA basics.
- Page layout: Standalone pages matching the landing page style (not dashboard). Clean typography, clear headings, "Last updated" date at top.
- Integration: Footer links on all pages (landing + dashboard), legal reference text near Stripe checkout button, no signup checkbox (reduces friction).
- Page structure: Standard sections — what we collect, how we use it, third parties, data retention, user rights, contact info (Privacy). Service description, user responsibilities, payment terms, cancellation/refunds, liability, changes to terms (ToS).
- Route structure: `/privacy` and `/terms` as public Next.js App Router pages (no auth required).

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing UI patterns
- `src/app/page.tsx` — Landing page layout to match for legal pages
- `src/app/layout.tsx` — Root layout where footer could be added
- `src/app/(dashboard)/` — Dashboard layout group (has its own layout)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Landing page at `src/app/page.tsx` — style reference for public pages
- Tailwind CSS utilities — consistent typography
- `src/app/layout.tsx` — Root layout, footer links go here for global coverage

### Established Patterns
- Public routes are direct children of `src/app/` (e.g., `page.tsx`)
- Dashboard routes use `(dashboard)` route group with auth
- No existing footer component — needs to be created or added inline to layout

### Integration Points
- Root layout footer — add Privacy/Terms links
- Dashboard layout footer — add Privacy/Terms links (if separate from root)
- Stripe checkout flow — add legal reference text near checkout button
- Landing page — ensure footer is visible

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard legal pages following common SaaS patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-legal-pages*
*Context gathered: 2026-03-21*

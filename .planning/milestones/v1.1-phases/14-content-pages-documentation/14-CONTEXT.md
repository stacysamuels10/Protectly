# Phase 14: Content Pages & Documentation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a comparison landing page (/compare), a help center page (/help), and beta onboarding documentation. All static content pages — no interactive features, no database changes.

</domain>

<decisions>
## Implementation Decisions

### Comparison Page
- **D-01:** Feature comparison table (PriCal vs Manual Calendly) PLUS time savings narrative section below. Both angles covered.
- **D-02:** No pricing on comparison page — keep it purely about what PriCal does vs not having it. Pricing lives on landing page.
- **D-03:** CTA to sign up / try PriCal at the bottom.

### Help Center
- **D-04:** Single /help page with collapsible accordion sections. Four sections: Getting Started, How-To Guides, Pricing FAQ, Troubleshooting.
- **D-05:** No search — with ~15-20 questions across 4 sections, accordion browse is sufficient.
- **D-06:** Beta getting-started guide content integrated into the Getting Started section of /help (not a separate page). Includes known limitations and feedback channel link.

### Claude's Discretion
- Comparison table rows (which features to compare)
- Time savings narrative framing
- Exact FAQ questions and answers per section
- Accordion component choice (Radix Accordion exists in UI primitives)
- Page styling (match landing page or legal page style)
- Beta documentation format (inline in help or separate doc)
- Feedback channel link destination (GitHub issues, email, or form)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing UI patterns
- `src/app/privacy/page.tsx` — Style reference for public content pages (Phase 11)
- `src/app/terms/page.tsx` — Style reference for public content pages (Phase 11)
- `src/app/page.tsx` — Landing page for CTA style reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/` — Radix UI Accordion component available (`@radix-ui/react-accordion`)
- Privacy/Terms pages (Phase 11) — established public page style with Tailwind typography
- Landing page CTA pattern — "Get Started" button style

### Established Patterns
- Public pages are direct children of `src/app/` (e.g., `privacy/page.tsx`, `terms/page.tsx`)
- Clean typography with `prose` Tailwind classes on content pages
- Footer links to /privacy and /terms already on all pages

### Integration Points
- New routes: `src/app/compare/page.tsx` and `src/app/help/page.tsx`
- Landing page nav — may need links to /compare and /help
- Footer — may need /help link added

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard content pages.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-content-pages-documentation*
*Context gathered: 2026-03-22*

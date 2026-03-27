# Feature Research

**Domain:** Booking protection SaaS — domain allowlisting and activity log UI
**Researched:** 2026-03-26
**Confidence:** HIGH (grounded in existing codebase analysis, domain allowlisting patterns from email security tools, activity log UX best practices from established SaaS)

---

## Context: What This Milestone Adds

Protectly v1.2 already has: email-based allowlist CRUD (25/500/2000/unlimited entries by tier), CSV import/export, webhook booking interception with 5 guest check modes, dashboard stats, activity log page (shows last 100 attempts, no filtering), settings, onboarding wizard, help center.

**Gaps being filled:**
1. **Domain allowlisting** — currently only individual email addresses can be approved; @company.com cannot be approved as a whole; users with 100 employees must add 100 emails individually
2. **Activity log UI** — page exists but is a static server-rendered list capped at 100; no filtering by status, no search by email, no pagination controls visible in UI, no "add to allowlist" action from a rejected booking row

**Constraint:** Stay within Next.js 15 / Prisma / PostgreSQL. Domain entries live alongside email entries in the existing `AllowlistEntry` model or a new parallel table. Webhook check logic in `route.ts` must be updated to handle domain matching.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once they learn "Protectly supports domain allowlisting." Missing these = feature feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Add a domain entry (@company.com)** | Core domain allowlisting feature. If this doesn't exist, the feature doesn't exist. | LOW | Store domain entries as `@company.com` or `company.com` (normalized to lowercase). Validate format: must be `@[domain].[tld]` or `[domain].[tld]` — reject full emails, reject bare strings without a dot. Use a simple regex: `/^@?[a-z0-9.-]+\.[a-z]{2,}$/i`. |
| **Delete a domain entry** | CRUD parity. Any list management UI must support removal. | LOW | Same delete endpoint/UI as email entries. Domain entries appear in the same allowlist table. |
| **Webhook check honors domain entries** | If domain entries exist but the webhook ignores them, the feature is worthless. This is the critical backend change. | MEDIUM | Current webhook: extracts `inviteeEmail`, checks it against `allowedEmailHashes`. Must add: extract domain from `inviteeEmail` (the part after `@`), check if `@[domain]` is in the allowlist. Domain check must be OR'd with email check: `isEmailApproved(email) OR isDomainApproved(email)`. Guest emails must also pass domain check under the existing guest check modes. |
| **Domain entries visible in allowlist UI** | Users need to see what they've added. Domain entries should appear in the same list as email entries (differentiated visually). | LOW | Show a globe/domain icon or "Domain" badge on rows that are domain entries vs a person icon for email entries. Render the stored value as-is (e.g., `@company.com`). |
| **Activity log status filter** | The existing page shows all 3 statuses in a mixed list. Users want to see "only rejected bookings." This is the most requested interaction for an activity log in any security/protection tool. | LOW | Client-side filter tabs (All / Approved / Rejected / Rate Limited) or server-side query param `?status=REJECTED`. API already supports `status` filter param — UI just needs to expose it. |
| **Activity log email search** | Users want to find "did bob@company.com try to book me?" Search by invitee email is expected on any list with more than ~20 items. | LOW | API `entries/route.ts` already supports `search` param with case-insensitive `contains`. Activity API needs the same. Add a search input to the UI that debounces and fires requests. |
| **Rejection reason visible in activity log** | When a booking is rejected, users want to know why (not on allowlist vs rate limited vs guest failed). The `rejectionReason` field exists on `BookingAttempt` but is not displayed in the current UI. | LOW | Show `rejectionReason` as a subtitle under the email in rejected rows. Already stored in DB — just needs to be surfaced. |

### Differentiators (Competitive Advantage)

Features that go beyond baseline and meaningfully improve the protection or workflow experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **"Add to allowlist" action from rejected booking row** | Closes the loop between "I see someone was rejected" and "I want to approve them." Without this, users must copy the email, navigate to the allowlist page, and paste it — 3-step friction. With this, it's one click. | MEDIUM | Button/link on each rejected row that either opens the add-email dialog pre-filled with the invitee's email, or POSTs directly to add the email. Must work for both email entries (add email) and potentially domain entries (add domain). Redirect or modal — modal preferred to stay on the activity page. |
| **Domain entry coverage indicator** | When users add a domain, show how many of their existing email entries would now be covered by that domain (i.e., have the same domain). Helps users decide whether to add a domain vs keep individual emails. | MEDIUM | Query count of existing entries matching the domain before confirming the add. Show "This will also cover 14 existing email entries in your list." This is a differentiator because it prevents list redundancy and educates users. |
| **Activity log pagination (load more or numbered pages)** | Current UI caps at 100 records with no pagination controls. High-volume users may have 500+ booking attempts in their retention window and can't find older events. | MEDIUM | API already supports cursor-based pagination (`page`, `limit`, `totalPages`). UI needs: page controls or "Load more" button. Load more (append to list) is better UX for a chronological log than numbered pages. |
| **Domain wildcard (subdomain) matching** | Enterprise users may want `@mail.company.com` to match alongside `@company.com`. Supporting explicit subdomain entries (not wildcard glob patterns) covers this without security risk. | LOW | Do not implement wildcard glob (`*.company.com`). Instead: exact domain match only. Users who want subdomain coverage add both `@company.com` and `@mail.company.com`. This is simpler, auditable, and avoids the security risk of broad wildcards. Document this decision in help text. |
| **"Quick add domain" shortcut in activity log** | When a user sees many rejected bookings from the same domain (@acme.com), offer a "Add @acme.com to allowlist" action alongside the individual "Add email" action. Extracts the domain from the rejected email and presents it as an option. | MEDIUM | In the "add to allowlist" modal triggered from a rejected row: show two options — "Add email (bob@acme.com)" and "Add domain (@acme.com)". Let user choose. This is the highest-value cross-feature interaction between domain allowlisting and activity log. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Wildcard glob domain patterns (`*.company.com`)** | Seems natural for "match all subdomains." Common in email security tools like Mimecast. | Wildcard patterns increase attack surface: `*.company.com` could match `evil.company.com` if a malicious actor creates a subdomain. Glob matching logic is also harder to audit and test. For Protectly's threat model (casual booking spam protection), exact domain matching is sufficient. | Exact domain match (`@company.com`). Users add multiple specific subdomains if needed. Document why wildcards were excluded. |
| **Bulk domain import via CSV** | Users with large lists may want to add 50 domains at once. Natural extension of the existing email CSV import. | Adds complexity to CSV parsing: mixed file with emails and domains requires column disambiguation or two-pass parsing. Edge cases multiply (what is `company.com` — a bare domain or a malformed email?). | Add domains one at a time in v1.2. Bulk domain CSV import can be added in v2 if user demand materializes. Individual add covers 95% of use cases (most users have 1-5 corporate domains). |
| **Domain blocklist (explicit deny)** | "I want to block everyone from @competitor.com from booking me." Inverse of allowlist. | Protectly's model is allowlist-only: block everything except what's explicitly approved. A separate deny list introduces two-list logic in the webhook check and confuses the mental model. Also, the ALLOW_ALL guest check mode bypasses protection entirely already. | The current model handles this: if the allowlist doesn't include @competitor.com, all bookings from those addresses are rejected by default. No explicit deny list needed. |
| **Per-event-type domain allowlists (paid tiers only)** | Power users want different domains approved for different meeting types (e.g., @vendor.com only for vendor calls, not for client demos). | Correct feature long-term, but adds significant UI complexity now: users must manage domain entries per event type, not just globally. The per-event-type email allowlist is already complex to manage. | Global domain allowlist only in v1.2. Per-event-type domain support deferred to v2. The global allowlist covers the vast majority of v1.2 use cases. |
| **Real-time activity feed with WebSockets** | Users want to see bookings appear in real-time as they happen, like a live dashboard. | Vercel serverless does not support persistent WebSocket connections without third-party infrastructure (Pusher, Ably, etc.). Adds significant cost and architectural complexity. Protectly's users are not watching the dashboard when bookings arrive — they want notifications, not a real-time ticker. | Email notifications (already built). Refresh-on-visit activity log. Manual refresh button if needed. Real-time feed deferred to v2+ only if user demand is clear. |
| **Activity log export (CSV)** | "I want to download my booking history for compliance." Logical extension of the CSV export on allowlists. | Low usage frequency (most users never export). Adds another endpoint and button to the activity UI. Not part of the core v1.2 goal. | Log data is accessible via the UI with filtering and search. Export deferred to v2 if users request it. |

---

## Feature Dependencies

```
[Domain allowlisting — storage]
    └──requires──> Schema change: add `type` discriminator to AllowlistEntry OR new DomainEntry table
    └──required by──> [Domain allowlisting — webhook check]
    └──required by──> [Domain entries visible in allowlist UI]
    └──required by──> [Add domain entry form/dialog]
    └──required by──> [Delete domain entry]

[Domain allowlisting — webhook check]
    └──requires──> [Domain allowlisting — storage] (domain entries must exist to check against)
    └──builds on──> existing timing-safe email check in calendly webhook route.ts
    └──must handle──> guest emails under existing 5 guest check modes (STRICT, PRIMARY_ONLY, etc.)

[Activity log — status filter]
    └──independent of domain allowlisting
    └──builds on──> existing API support (status param already implemented in GET /api/dashboard/activity)
    └──requires──> UI change only (filter tabs/buttons)

[Activity log — email search]
    └──independent of domain allowlisting
    └──requires──> API change: add `search` param to /api/dashboard/activity (currently no search support)
    └──requires──> UI change: search input with debounce

[Activity log — "add to allowlist" action]
    └──requires──> [Domain allowlisting — storage] (to offer "add domain" option)
    └──requires──> existing allowlist entry POST endpoint
    └──enhances──> [Activity log — status filter] (most useful on filtered REJECTED view)
    └──enables──> "Quick add domain" shortcut

["Quick add domain" from activity log]
    └──requires──> [Domain allowlisting — storage]
    └──requires──> [Activity log — "add to allowlist" action] (extends the same modal)

[Activity log — pagination]
    └──independent (API already supports pagination, UI just needs controls)
    └──works best with──> [Activity log — status filter] (pagination + filter = full power)

[Rejection reason display]
    └──independent (data exists in DB, just not rendered)
    └──requires──> UI change only (add rejectionReason text to rejected rows)
```

### Dependency Notes

- **Schema change is the gating dependency for domain allowlisting:** The storage model must be decided before any other domain feature can be built. Two options: (1) add a `type` enum column to `AllowlistEntry` (`EMAIL` | `DOMAIN`) — lower migration cost, reuses existing table and CRUD, OR (2) new `DomainEntry` table — cleaner separation but doubles the allowlist-related table count and duplicates CRUD logic. Recommend option 1 (add `type` column): lower complexity, reuses existing pagination/search/CRUD, single conceptual "allowlist" for users.
- **Activity log improvements are independent of domain allowlisting:** Can be built in either order. Recommend building activity log improvements first (lower risk) then domain allowlisting (higher complexity).
- **"Add to allowlist" action bridges both features:** It's the highest-value interaction but depends on domain allowlisting storage being complete first.
- **Webhook check is the highest-risk change:** It modifies the core protection logic. Must have full test coverage before deployment.

---

## MVP Definition

### Must Ship (Core v1.2 Goals)

- [ ] **Domain entry storage** — schema migration to add `type` column (`EMAIL` | `DOMAIN`) to `AllowlistEntry`; normalize domain to lowercase `@domain.tld` format on write
- [ ] **Add domain entry UI** — extend existing add-email dialog or add separate "Add domain" path; validate domain format
- [ ] **Delete domain entry** — reuses existing delete endpoint (no change needed if schema approach is used)
- [ ] **Domain entries displayed in allowlist UI** — badge/icon distinguishing domain rows from email rows
- [ ] **Webhook check: domain matching** — after email check fails, extract domain from `inviteeEmail` and check against domain entries; apply same logic to guest emails under guest check modes
- [ ] **Activity log: status filter tabs** — All / Approved / Rejected / Rate Limited; uses existing API `status` param
- [ ] **Activity log: rejection reason display** — show `rejectionReason` field on rejected rows (data already in DB)
- [ ] **Activity log: pagination controls** — expose existing API pagination in the UI

### Add After Core (High Value, Low Risk)

- [ ] **"Add to allowlist" action from rejected row** — opens modal pre-filled with rejected email; offer domain option if domain allowlisting is complete
- [ ] **Activity log: email search** — requires adding `search` param to `/api/dashboard/activity`; UI debounced search input

### Future Consideration (v2+)

- [ ] **Domain coverage indicator** — show how many existing email entries a new domain would cover; useful but adds a query round-trip on every domain input
- [ ] **Bulk domain CSV import** — deferred until single-add is proven and user demand for bulk is confirmed
- [ ] **Per-event-type domain allowlists** — deferred; global domain allowlist covers v1.2 use cases
- [ ] **Activity log CSV export** — deferred; low frequency need, not core protection value

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Domain entry storage (schema + normalization) | HIGH (enables entire domain feature) | LOW (one migration, enum column) | P1 |
| Webhook domain check | HIGH (core protection logic) | MEDIUM (modify webhook handler + tests) | P1 |
| Add/delete domain entry UI | HIGH (users can't manage domains without it) | LOW (extend existing dialog) | P1 |
| Domain entries visible in allowlist | HIGH (users must see what they added) | LOW (badge/icon on existing row component) | P1 |
| Activity log status filter | HIGH (most common user action on activity log) | LOW (UI only, API exists) | P1 |
| Rejection reason display | HIGH (answers "why was this rejected?") | LOW (data exists, render it) | P1 |
| Activity log pagination | MEDIUM (needed for users with >100 attempts) | LOW (API exists, UI controls needed) | P1 |
| "Add to allowlist" from rejected row | HIGH (eliminates copy-paste workflow) | MEDIUM (modal + pre-fill + domain option) | P2 |
| Activity log email search | MEDIUM (useful for looking up specific people) | LOW (API change + debounced input) | P2 |
| Domain coverage indicator | LOW (informational, not blocking) | MEDIUM (extra query on domain input) | P3 |
| "Quick add domain" from activity log | MEDIUM (smart UX shortcut) | LOW (extends "add to allowlist" modal) | P2 |

**Priority key:**
- P1: Must have for v1.2 milestone
- P2: Should have — add if scope allows, high value
- P3: Nice to have — future consideration

---

## Implementation Notes

### Domain Storage: Recommended Approach

Add `type` enum to `AllowlistEntry`:

```prisma
enum AllowlistEntryType {
  EMAIL
  DOMAIN
}

model AllowlistEntry {
  // ... existing fields ...
  type   AllowlistEntryType @default(EMAIL)
}
```

Normalize domain entries on write: strip leading `@` if present, lowercase, store as `company.com`. Display with `@` prefix in UI for clarity. Validate: must contain exactly one dot, no spaces, no `@` in middle.

### Webhook Domain Check: Recommended Approach

Current check: `isEmailApproved(inviteeEmail)` using timing-safe hash comparison.

Add after email check: extract domain from email (`email.split('@')[1]`), call `isDomainApproved(domain)`. Use same timing-safe comparison approach with stored domain hashes.

The `allowedEmailHashes` set in the webhook handler will need to be split into `allowedEmailHashes` and `allowedDomainHashes` (or unified in a Set that stores hashes of both normalized emails and normalized domains).

Applies to: invitee email AND all guest emails under the relevant guest check modes.

### Activity Log UI: Recommended Approach

Convert `activity/page.tsx` from a server-rendered static page to a client component (or hybrid: server shell + client-side interactive table). The existing API supports status filter, page, and limit. Add search param support. Expose all of these through the UI.

Filter tabs: stateless URL params (`?status=REJECTED`) to make filtered views shareable/bookmarkable.

---

## Sources

- [Mimecast wildcard policies documentation](https://mimecastsupport.zendesk.com/hc/en-us/articles/34000718440467-Policies-Wildcards-In-Policies) — MEDIUM confidence (email security vendor, informs what NOT to build for wildcards)
- [Audit Logging Best Practices — Sonar](https://www.sonarsource.com/resources/library/audit-logging/) — MEDIUM confidence (industry analysis)
- [Guide to Building Audit Logs for Application Software — Medium/Infisical](https://medium.com/@tony.infisical/guide-to-building-audit-logs-for-application-software-b0083bb58604) — MEDIUM confidence (practitioner article, corroborated by other sources)
- [SaaS Bulk Actions UX — Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux) — MEDIUM confidence (design agency analysis)
- Existing Protectly codebase analysis — HIGH confidence (authoritative: `prisma/schema.prisma`, `src/app/api/dashboard/activity/route.ts`, `src/app/api/allowlists/[id]/entries/route.ts`, `src/lib/guest-check.ts`, `src/app/(dashboard)/dashboard/activity/page.tsx`, `src/app/(dashboard)/dashboard/allowlist/page.tsx`)

---

*Feature research for: Protectly v1.2 — domain allowlisting and activity log UI*
*Researched: 2026-03-26*

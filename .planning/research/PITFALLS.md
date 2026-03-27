# Pitfalls Research

**Domain:** Booking protection app — adding domain allowlisting and activity log UI to existing Protectly system
**Researched:** 2026-03-26
**Confidence:** HIGH (based on direct codebase analysis of v1.1 state)

---

## Critical Pitfalls

### Pitfall 1: Domain check bypasses `evaluateGuestCheckMode` entirely

**What goes wrong:**
The existing email check in `route.ts` runs through `isEmailApproved()`, whose boolean result feeds into `evaluateGuestCheckMode()`. All 5 guest check modes (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL) depend on this function's output. A domain check written as a separate code path — `isDomainApproved(email)` checked outside `isEmailApproved` — means guests and invitees matched by domain skip the mode logic entirely. In STRICT mode, for example, a guest with a matching domain would never be evaluated against the "all guests must be approved" rule.

**Why it happens:**
Domain matching feels categorically different from exact email lookup, so developers write it as a new branch alongside rather than inside the existing `isEmailApproved` function. The integration point (`evaluateGuestCheckMode`) is not obviously the place to wire in domain support.

**How to avoid:**
Extend `isEmailApproved(email: string)` to return `true` when the email's domain matches any entry in the domain allowlist. Keep it a single function so all 5 modes continue to work without modification. The domain check is an OR condition on the same boolean: email match OR domain match = approved.

**Warning signs:**
- A new `isDomainApproved` function called separately after the `evaluateGuestCheckMode` call
- `evaluateGuestCheckMode` call site has been changed to accept domain-specific parameters
- No test covering a guest with an approved domain in STRICT mode

**Phase to address:**
Domain allowlisting — backend/webhook integration phase

---

### Pitfall 2: Domain entries stored in `AllowlistEntry.email` column using a `@domain.com` convention instead of a migration

**What goes wrong:**
The `AllowlistEntry.email` column is typed `@db.VarChar(255)` with `@@unique([allowlistId, email])` and `@@index([email])`. Storing domain entries as `@company.com` in this field creates silent failures: existing email-format validation rejects or allows them inconsistently, the audit log's `targetEmail` field stores the same ambiguous string, CSV import/export treats them as email rows, and queries that filter by exact email naturally miss them. The most likely failure mode is that the CSV export round-trips without domain entries because the import parser applies email-format validation and silently drops them.

**Why it happens:**
Adding a column requires a Prisma migration. Reusing the existing field avoids migration overhead and looks compatible at first glance. The `@` prefix feels like a reasonable convention.

**How to avoid:**
Run a Prisma migration to add explicit domain support. Two options:

Option A (preferred): Add an `entryType` enum (`EMAIL | DOMAIN`) and a nullable `domain` field to `AllowlistEntry`. Store domains in `domain`, emails in `email`. Clean queries, no ambiguity.

Option B (acceptable): Store domains as `@company.com` in `email` but add a boolean `isDomain` column to distinguish them. Update all validation, import, export, and check logic to use this flag.

Do not rely on the `@` prefix alone — type safety and query clarity require an explicit discriminator.

**Warning signs:**
- No migration file present when domain feature ships
- `AllowlistEntry.email` validation accepts strings starting with `@` without a corresponding `isDomain` flag
- CSV export does not include domain entries in the download

**Phase to address:**
Domain allowlisting — schema and migration phase (must be decided before any implementation)

---

### Pitfall 3: Activity log page bypasses the paginated API, making filter/pagination UI impossible

**What goes wrong:**
`src/app/(dashboard)/dashboard/activity/page.tsx` is a Server Component that calls `prisma.bookingAttempt.findMany` directly with `take: 100`. The API route at `/api/dashboard/activity` already supports pagination (`page`, `limit`, `status` filter, `total`, `totalPages`). These two implementations diverge. When the activity log UI feature adds filter controls (status filter) and pagination, developers building on the page component discover it cannot support interactive filtering without a full rewrite — the filter state must survive re-renders, which requires client-side data fetching or URL-driven SSR params. If nobody notices the divergence, pagination UI gets wired to a component that always silently shows at most 100 records.

**Why it happens:**
The page was built as a quick SSR render for v1.1. The API was built separately for potential client-side use. They were never connected.

**How to avoid:**
For the activity log UI feature, decide the data-fetching pattern before writing any UI code. The correct path: convert the page to a client component and fetch from the existing `/api/dashboard/activity` endpoint, which already has pagination and status filter support. Alternatively, drive SSR filtering via URL search params routed to the API. The SSR `prisma.bookingAttempt.findMany` call in the page should be removed once the client-side fetch is in place.

**Warning signs:**
- Filter or pagination UI added to the existing SSR page component with no API call
- `take: 100` unchanged in the page's Prisma query after pagination UI is added
- Two separate Prisma queries for the same data (page component + API route running in parallel)

**Phase to address:**
Activity log UI implementation phase

---

### Pitfall 4: Domain entries not handled by the CSV import pipeline

**What goes wrong:**
The CSV import feature (Pro-gated, already shipped) parses rows and creates `AllowlistEntry` records. If a user imports a CSV containing `@acme.com`, the current parser applies email-format validation and either rejects the row or stores it malformed. Even after domain support is added to the schema, the CSV import will silently drop domain rows unless the parser is updated at the same time. Users who try to bulk-import their corporate domain list via CSV get no error — the rows are just absent from their allowlist.

**Why it happens:**
CSV import was built before domain allowlisting existed. It is easy to forget an existing bulk-entry path when adding a new entry type.

**How to avoid:**
Update the CSV import handler (`/api/allowlists/[id]/import` or equivalent) in the same phase as the domain entry model. Add domain-format detection to the parser. Test the full round-trip: import a CSV with `@acme.com`, verify the domain entry is created, trigger a test webhook from `user@acme.com`, verify approval. Also update CSV export to include domain entries so the round-trip is complete.

**Warning signs:**
- Domain feature ships but CSV import tests are unchanged
- CSV export omits domain entries
- No test covering `POST /api/allowlists/[id]/import` with a `@domain.com` row

**Phase to address:**
Domain allowlisting — CRUD phase (same phase as entry model, not a separate phase)

---

### Pitfall 5: Webhook handler's `prisma.user.findFirst` include block not updated to fetch domain entries

**What goes wrong:**
The webhook handler fetches the user with a specific `include` block that only loads `allowlists.entries`. After domain entries are added (whether as a new relation or a new column on `AllowlistEntry`), the include block must be updated to also fetch them. If it is not, `isEmailApproved` runs against email-only allowlist data and domain matching silently never fires. Bookings from domain-matched emails get rejected. This failure is silent — no error is thrown, the booking is just incorrectly cancelled.

**Why it happens:**
The Prisma query in the webhook handler is written once and not revisited when the schema changes. Schema migrations and application code changes are done in separate PRs/phases without cross-referencing the query.

**How to avoid:**
Treat the webhook handler's `prisma.user.findFirst` include block as a required update checklist item when any change is made to allowlist-related models. After the domain schema migration, grep for all places that load `allowlists.entries` and verify each one fetches both email and domain data.

**Warning signs:**
- Migration adds domain support but no changes in `route.ts` (webhook handler)
- `prisma.user.findFirst` include block only lists `entries`, not domain entries
- Integration test: booking from `user@approved-domain.com` shows as REJECTED in the activity log

**Phase to address:**
Domain allowlisting — backend/webhook integration phase

---

### Pitfall 6: Domain format not validated server-side, allowing malformed entries

**What goes wrong:**
A user submits `@` (bare at-sign), `@.com` (invalid TLD), or `company.com` (missing `@` prefix) as a domain entry. Without server-side validation, these are stored in the database. During webhook processing, the domain check runs against malformed patterns. `@` could match any email (catastrophic bypass). `company.com` without `@` would never match. The first bug is a silent protection bypass; the second is a silent ineffective entry.

**Why it happens:**
Email validation is well-understood and libraries handle it. Domain entry validation is custom and easy to skip in the "just make it work" pass.

**How to avoid:**
Add a Zod schema for domain entries on the CRUD endpoint. Accept only strings matching `/^@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i`. Reject `@`, `@.com`, bare `company.com`, and IP addresses. Lowercase-normalize on write (same as email normalization). Add this validation before writing tests — the test suite should reject these inputs.

**Warning signs:**
- Domain entry CRUD endpoint has no Zod schema for the domain field
- `@` accepted as a valid domain entry
- Domain stored without lowercase normalization (`@COMPANY.COM` and `@company.com` both stored)

**Phase to address:**
Domain allowlisting — CRUD phase

---

### Pitfall 7: Activity log shows no context for why a domain-matched booking was approved

**What goes wrong:**
`BookingAttempt` records for approved bookings have no `approvalReason` field — only rejected bookings carry `rejectionReason`. When domain allowlisting is added, a booking from `user@company.com` matched via a domain entry shows as "Approved" in the activity log UI with no indication of why. Users managing both email and domain allowlists cannot tell whether a booking was approved by exact email match or by domain match. This creates confusion when debugging unexpected approvals ("Why did this person get through?").

**Why it happens:**
Approval context was never needed before because the only path to approval was an exact email match, which is self-explanatory. Domain matching introduces a new approval path where the matched rule is not obvious from the invitee email alone.

**How to avoid:**
When creating a `BookingAttempt` with `status: 'APPROVED'`, optionally set `rejectionReason` (or add an `approvalReason` field via migration) to record the match source: `"Matched email"`, `"Matched domain: @company.com"`. This is a small schema change with high UI value. Alternatively, use the existing `rejectionReason` field for both paths (rename it conceptually to `reason`) without a schema change.

**Warning signs:**
- `BookingAttempt.create` for approved bookings passes no `rejectionReason` or match context
- Activity log UI shows "Approved" with empty reason column for domain-matched bookings
- No way to distinguish email-matched from domain-matched approvals in the log

**Phase to address:**
Activity log UI phase (can be combined with domain schema work if timing allows)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store domains in `AllowlistEntry.email` with `@` prefix convention | No migration needed | Breaks email validation, CSV round-trip, future queries; ambiguous schema | Never — migration cost is low |
| Domain check as separate code path outside `isEmailApproved` | Faster to write | 5 guest check modes silently skip domain check for guests; logic bifurcation grows | Never — guestCheckMode is a core invariant |
| Skip domain format validation in the "first pass" | Faster to ship | `@` entry bypasses all protection; malformed entries silently don't match | Never — `@` bypass is a security issue |
| Leave activity log page as SSR-only with `take: 100` | No refactor needed | Pagination/filter UI requires full rewrite if added later | Acceptable only if no filter UI is planned in v1.2 |
| Skip `approvalReason` for domain-matched approvals | No migration | Users can't explain why a booking was approved via domain; support burden | Acceptable for v1.2 MVP, add in v1.3 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `evaluateGuestCheckMode` | Adding domain check as a new code path that runs after the mode evaluation | Extend `isEmailApproved(email)` to include domain check; pass the same boolean into `evaluateGuestCheckMode` unchanged |
| Prisma webhook query | Not updating the `include` block when domain model is added | Grep for all `allowlists.entries` includes; update each one to also fetch domain data after migration |
| CSV import | Updating schema but not the import parser | Import + export must be updated in the same PR as the schema change; test the round-trip explicitly |
| Activity log API | Building filter UI on the SSR page component | Route all filter and pagination interactions through `/api/dashboard/activity`; it already supports `status`, `page`, `limit` |
| AuditLog | `targetEmail` field stores domain as `@company.com` | Acceptable; add a code comment documenting the convention so future readers are not confused |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all allowlist entries (email + domain) into memory per webhook | Works fine at 25-500 entries | Domain list is checked O(n) — acceptable at current tier limits (max 2000 entries); no additional query needed if fetched in the same include | Business/Enterprise users with 2000+ combined entries |
| Activity log page fetching 100 records in SSR on every navigation | Fine now | Convert to paginated client-side fetch; existing API already supports it | Users with >100 booking attempts per retention window |
| `groupBy` on BookingAttempt without covering index for new domain-based filter | Slow filter queries | Existing `@@index([userId, createdAt(sort: Desc)])` and `@@index([status])` cover current filters; domain match filter (if added) needs `@@index([matchSource])` | 10k+ BookingAttempt records per user |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `@` accepted as a valid domain entry | Matches any email — complete protection bypass | Server-side Zod validation rejects bare `@`; test this explicitly |
| Domain stored without lowercase normalization | `@COMPANY.COM` and `@company.com` treated as different entries; mixed-case entry misses matches | Lowercase-normalize domain on write, same as email normalization |
| Domain entry CRUD endpoint missing ownership check | User A could add domains to User B's allowlist | Apply existing pattern: `allowlist.findFirst({ where: { id, userId: user.id } })` before any write |
| Activity log retention cutoff bypassed via query param manipulation | FREE users retrieve >30 days of history by passing `page=999` | Existing `cutoffDate` applied at query level — preserve it when adding domain filter param to the API |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Domain and email entries shown in the same list with no visual distinction | Users can't tell which entries cover a whole domain vs. one person | Add a "Type" badge (Email / Domain) to the allowlist table |
| No confirmation when adding a domain entry explaining its scope | User may not realize `@company.com` approves all emails from that domain | Show inline warning: "This will allow all bookings from @company.com (any email at this domain)" |
| Activity log shows "Approved" with no match source for domain entries | Users debugging unexpected approvals can't identify which rule matched | Display match source in the reason column: "Matched domain: @company.com" |
| Activity log filter state lost on back-navigation | User filters to REJECTED, clicks a row, goes back, filter resets | Use URL search params (`?status=REJECTED`) to persist filter state across navigation |
| Empty state missing for "no results after filtering" | Filtered activity log with zero results renders broken or empty layout | Distinguish empty state (no activity yet) from zero-results state (no matches for filter) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Domain allowlisting — webhook integration:** Verify by triggering a test webhook from `user@approved-domain.com` — BookingAttempt record should show APPROVED, not REJECTED
- [ ] **Domain allowlisting — guest check modes:** Verify STRICT mode rejects a booking where the invitee's domain is approved but a guest's email is not on the list
- [ ] **Domain allowlisting — format validation:** Verify API rejects `@`, `@.com`, `company.com` (no `@`), and blank; accepts `@company.com`, `@sub.domain.co.uk`
- [ ] **Domain allowlisting — normalization:** Verify `@COMPANY.COM` and `@company.com` are treated as the same entry (unique constraint hit on duplicate add attempt)
- [ ] **Domain allowlisting — CSV round-trip:** Import a CSV containing `@acme.com` and verify a domain entry is created; export and verify the domain appears in the CSV
- [ ] **Activity log UI — pagination:** Verify page 2 returns different records than page 1 (not the same 100 repeated)
- [ ] **Activity log UI — retention enforcement:** Verify FREE tier user cannot retrieve records older than 30 days by passing `page=10` to the API
- [ ] **Activity log UI — filter persistence:** Verify `?status=REJECTED` in the URL pre-selects the REJECTED filter on page load
- [ ] **Activity log UI — zero results state:** Verify filtering to RATE_LIMITED with no such records shows a "no results" message, not an empty broken layout
- [ ] **Webhook include block:** After migration, verify `prisma.user.findFirst` in `route.ts` loads domain entries in the same query that loads email entries

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Domain entries stored in email column without migration | MEDIUM | Write migration adding `entryType` enum column; backfill based on `@` prefix detection; update all validation and check logic; redeploy |
| Domain check bypasses `evaluateGuestCheckMode` | MEDIUM | Refactor `isEmailApproved` to include domain check; rerun all guest-check mode tests; redeploy |
| Webhook include block not updated | LOW | Add domain entries to the include block; deploy; no data migration needed |
| CSV import drops domain entries silently | LOW | Update CSV parser; add test; deploy; no schema changes if entry model is already correct |
| `@` accepted as a valid domain (protection bypass) | HIGH | Hotfix to reject bare `@` in CRUD endpoint; audit existing entries for `@` and delete them; notify affected users if any bookings slipped through |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Domain check bypasses `evaluateGuestCheckMode` | Domain — webhook integration | Unit test: domain-matched email feeds into all 5 guest check mode outcomes correctly |
| Domain entries stored in email column | Domain — schema/migration | Migration file present; entry model has explicit domain discriminator |
| Webhook include block not updated | Domain — webhook integration | Integration test: booking from approved domain shows APPROVED in activity log |
| CSV import drops domain entries | Domain — CRUD | Round-trip test: import CSV with `@domain.com`, verify domain entry created |
| No domain format validation | Domain — CRUD | API rejects `@`, `@.com`, bare `company.com`; accepts `@company.com` |
| Activity log SSR vs API divergence | Activity log UI | Filter UI wired to `/api/dashboard/activity`; SSR direct Prisma call removed or relegated to initial shell |
| No match source in activity log | Activity log UI | APPROVED records from domain-matched bookings show "Matched domain: @..." in the reason column |

---

## Sources

- Codebase: `src/app/api/webhooks/calendly/route.ts` — webhook handler, `isEmailApproved`, `evaluateGuestCheckMode` call site
- Codebase: `src/lib/guest-check.ts` — `evaluateGuestCheckMode` interface and all 5 mode implementations
- Codebase: `prisma/schema.prisma` — `AllowlistEntry`, `BookingAttempt`, `AuditLog` model definitions
- Codebase: `src/app/(dashboard)/dashboard/activity/page.tsx` — SSR direct Prisma query with `take: 100`
- Codebase: `src/app/api/dashboard/activity/route.ts` — existing paginated API with status filter
- Codebase: `src/lib/utils.ts` — `TIER_LIMITS` with `activityLogDays` retention per tier
- Domain knowledge: timing-safe comparison, domain validation patterns, Prisma include block maintenance

---
*Pitfalls research for: domain allowlisting + activity log UI (Protectly v1.2)*
*Researched: 2026-03-26*

# Architecture Research

**Domain:** Domain allowlisting + activity log UI additions to Protectly (Next.js 15 App Router)
**Researched:** 2026-03-26
**Confidence:** HIGH — derived from direct codebase inspection

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Dashboard Pages (RSC)                       │
├────────────────────────┬────────────────────────────────────────┤
│  /dashboard/allowlist  │  /dashboard/activity                   │
│  (existing, MODIFY)    │  (existing, MODIFY)                    │
│                        │                                        │
│  AllowlistPage         │  ActivityPage                          │
│  + domain tab/section  │  + tabs: Bookings | Allowlist Changes  │
│  + DomainAllowlist-    │  + filter controls                     │
│    Section component   │  + pagination                          │
└────────────────────────┴────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      API Routes                                  │
├─────────────────────────────────────────────────────────────────┤
│  NEW: /api/allowlists/[id]/domains  (GET, POST)                  │
│  NEW: /api/allowlists/[id]/domains/[domainId]  (DELETE)          │
│  EXISTING: /api/dashboard/activity  (GET) — extend query params  │
│  NEW: /api/dashboard/audit-log  (GET) — expose AuditLog table    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   Domain + Data Layer (Prisma)                   │
├─────────────────────────────────────────────────────────────────┤
│  NEW model: DomainEntry  (id, allowlistId, domain, ...)          │
│  EXISTING: AllowlistEntry  (email-only, unchanged)               │
│  EXISTING: AuditLog  (ADD/REMOVE/BULK_IMPORT/CLEAR, append-only) │
│  EXISTING: BookingAttempt  (APPROVED/REJECTED/RATE_LIMITED)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              Webhook Handler (MODIFY to add domain check)        │
├─────────────────────────────────────────────────────────────────┤
│  /api/webhooks/calendly/route.ts                                 │
│  Current: isEmailApproved() checks AllowlistEntry hashes         │
│  New: isDomainApproved() checks inviteeEmail domain suffix       │
│       against DomainEntry table (called after email check fails) │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `AllowlistPage` | Server page — fetches allowlist + domains, renders both | MODIFY |
| `AllowlistTable` | Client — email entry CRUD table | EXISTING, no change |
| `DomainAllowlistSection` | Client — domain entry CRUD UI | NEW |
| `AddDomainDialog` | Client — input + submit for new domain patterns | NEW |
| `ActivityPage` | Server page — fetch booking attempts + audit log | MODIFY |
| `ActivityTable` | Client — paginated booking attempts with filter | NEW (extract from page) |
| `AuditLogTable` | Client — paginated allowlist change audit trail | NEW |
| `/api/allowlists/[id]/domains` | API — CRUD for domain entries | NEW |
| `/api/dashboard/audit-log` | API — paginated AuditLog query | NEW |
| `/api/dashboard/activity` | API — booking attempts (already exists) | EXTEND (add date filter) |
| Webhook handler | Booking interception + allowlist enforcement | MODIFY (add domain check) |

## Recommended Project Structure

Changes relative to existing structure only:

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── allowlist/
│   │       │   └── page.tsx          # MODIFY — add domain section
│   │       └── activity/
│   │           └── page.tsx          # MODIFY — add tabs + pagination
│   └── api/
│       ├── allowlists/
│       │   └── [id]/
│       │       └── domains/
│       │           ├── route.ts       # NEW — GET list, POST create domain
│       │           └── [domainId]/
│       │               └── route.ts   # NEW — DELETE domain entry
│       └── dashboard/
│           ├── activity/
│           │   └── route.ts           # EXTEND — date range + pagination params
│           └── audit-log/
│               └── route.ts           # NEW — paginated AuditLog
├── components/
│   └── dashboard/
│       ├── domain-allowlist-section.tsx  # NEW — domain list + add form
│       ├── add-domain-dialog.tsx         # NEW — dialog for adding domain pattern
│       ├── activity-table.tsx            # NEW — extracted client table for bookings
│       └── audit-log-table.tsx           # NEW — client table for AuditLog entries
└── prisma/
    └── schema.prisma                     # MODIFY — add DomainEntry model
```

### Structure Rationale

- **`/api/allowlists/[id]/domains/`:** Mirrors the existing `/api/allowlists/[id]/entries/` pattern exactly. Same ownership verification, same tier limit pattern.
- **`/api/dashboard/audit-log/`:** Separate from `/api/dashboard/activity/` because they query different tables (AuditLog vs BookingAttempt) and serve different UI tabs.
- **`domain-allowlist-section.tsx`:** Separate component from `allowlist-table.tsx` because domain entries have different fields and validation (pattern format, no `name` field). Co-locating in the same page keeps the allowlist UX unified without coupling the two components.
- **`activity-table.tsx` + `audit-log-table.tsx`:** The current `activity/page.tsx` is a Server Component that directly renders the list. Extracting to client components enables pagination and tab-switching without full page reloads.

## Architectural Patterns

### Pattern 1: Domain Suffix Check in Webhook Handler

**What:** After the existing `isEmailApproved()` check returns false, extract the domain from the invitee email and check it against the `DomainEntry` table. The domain check is a secondary fallback — email match wins first.

**When to use:** Applies only in the webhook handler's allowlist evaluation. The `isEmailApproved()` function handles timing-safe comparison for emails; domain check can be plain case-insensitive suffix comparison since domain patterns are not sensitive to timing attacks.

**Trade-offs:** Simple and fast. The domain list is fetched as part of the same `include` on the existing allowlists query — no extra DB round-trip.

**Example:**
```typescript
// In webhook handler, after building allowedEmailHashes:
const domainEntries = globalAllowlist?.domainEntries || []
const allowedDomains = domainEntries.map(d => d.domain.toLowerCase())

function isDomainApproved(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return allowedDomains.some(d => domain === d || domain.endsWith('.' + d))
}

// Combined check replaces the existing single check:
const inviteeApproved = isEmailApproved(inviteeEmail) || isDomainApproved(inviteeEmail)
```

### Pattern 2: DomainEntry Model — New Sibling to AllowlistEntry

**What:** Add a `DomainEntry` model with the same `allowlistId` foreign key as `AllowlistEntry`. The two models live side by side — emails in one table, domains in the other.

**When to use:** This avoids adding a `type` discriminator column to `AllowlistEntry`, which would require touching all existing query code, tests, and CSV logic. Two focused tables are cleaner than one polymorphic table.

**Trade-offs:** Requires schema migration and two fetch paths. Benefit: zero changes to existing email CRUD API routes and tests.

**Schema addition:**
```prisma
model DomainEntry {
  id          String    @id @default(uuid())
  allowlistId String
  allowlist   Allowlist @relation(fields: [allowlistId], references: [id], onDelete: Cascade)

  domain      String    @db.VarChar(253)  // max domain length per RFC 1035
  notes       String?   @db.Text

  addedById   String?
  addedBy     User?     @relation("DomainAddedByUser", fields: [addedById], references: [id], onDelete: SetNull)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([allowlistId, domain])
  @@index([domain])
  @@map("domain_entries")
}
```

Add `domainEntries DomainEntry[]` to the `Allowlist` model relation.

### Pattern 3: Tabs for Activity Log UI

**What:** The existing `activity/page.tsx` is a static Server Component rendering a single list. For v1.2, use a client-side tab switcher (two tabs: "Booking Attempts" and "Allowlist Changes") that fetches from two separate API routes. Each tab has its own pagination state.

**When to use:** The two data sources (BookingAttempt and AuditLog) are distinct entities with different columns and different user mental models. Tabs avoid the page growing too long and keep each view focused.

**Trade-offs:** Requires a client shell component for tab state. The initial server render can still fetch the first page of booking attempts for the default tab to avoid a loading flash.

### Pattern 4: AuditLog Extension for Domain Events

**What:** Reuse the existing `AuditLog` model for domain allowlist mutations. The `targetEmail` column stores domain patterns when `action` is a domain action. Add two new `AuditAction` enum values: `ADD_DOMAIN` and `REMOVE_DOMAIN`.

**When to use:** Keeps the audit trail in one place. The existing `AuditLog` fetch (by `userId + createdAt`) naturally returns both email and domain actions sorted together.

**Trade-offs:** The `targetEmail` column name becomes slightly misleading for domain entries. Renaming to `target` is an option but adds migration cost. Document the dual use; the `action` enum value makes the type unambiguous to consumers.

## Data Flow

### Domain CRUD Flow (new)

```
User adds domain "company.com" via AddDomainDialog
    ↓
Client strips leading "@" if present, submits POST /api/allowlists/[id]/domains
    ↓
API: validate domain format (Zod), check tier domain limit
    ↓
prisma.auditLog.create({ action: 'ADD_DOMAIN', targetEmail: domain })
    ↓
prisma.domainEntry.create(...)
    ↓
Response 200 → client router.refresh() → RSC re-renders page with new domain
```

### Webhook Domain Check Flow (modified)

```
Calendly sends invitee.created event
    ↓
Webhook handler: signature verify, idempotency check (unchanged)
    ↓
Fetch user with allowlist including BOTH entries AND domainEntries (one include added)
    ↓
isEmailApproved(inviteeEmail) → false
    ↓
isDomainApproved(inviteeEmail) → true if "company.com" is in domainEntries
    ↓
inviteeApproved = true → guestCheckMode evaluation proceeds normally
    ↓
BookingAttempt.create with status APPROVED
    ↓
Response: { received: true, status: 'approved' }
```

### Activity Log UI Flow (modified)

```
User navigates to /dashboard/activity
    ↓
ActivityPage (RSC): fetch first page of BookingAttempts (existing query)
    ↓
Render page with two tabs:
  Tab 1 (default): ActivityTable (client) — shows pre-fetched booking data, paginates via API
  Tab 2: AuditLogTable (client) — fetches GET /api/dashboard/audit-log on first activation
    ↓
User switches to "Allowlist Changes" tab
    ↓
AuditLogTable: GET /api/dashboard/audit-log?page=1&limit=25
    ↓
Render: action badge (ADD/REMOVE/ADD_DOMAIN/REMOVE_DOMAIN), target value, timestamp
```

### Key Data Flows

1. **Domain allowlist check in webhook:** Runs AFTER email check fails. A single additional `domainEntries` include on the existing allowlists fetch — no extra DB round-trip.
2. **AuditLog exposure:** `AuditLog` table already has data from allowlist mutations. New `/api/dashboard/audit-log` route reads it using the same `userId + createdAt` index already defined in schema.
3. **Domain tier limits:** Reuse `TIER_LIMITS` in `utils.ts`. Add `domainEntries` count limit per tier (suggested: 10 FREE, 100 PRO, 500 BUSINESS, Infinity ENTERPRISE). This is a `TIER_LIMITS` object change only.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current monolith is fine. Domain check adds negligible load. |
| 1k-100k users | Index on `domain_entries.allowlistId` (already specified in schema above) handles lookup at scale. |
| 100k+ users | Cache allowlist data (emails + domains) in Redis per user. Domain list is small; DB read unlikely to be the bottleneck before email list is. |

### Scaling Priorities

1. **First bottleneck:** Webhook handler DB query (already optimized with selective includes). Adding `domainEntries` to the include is negligible at current scale (Railway single PostgreSQL instance, low traffic).
2. **Second bottleneck:** Activity log queries as history grows. Existing `@@index([userId, createdAt(sort: Desc)])` on `booking_attempts` already handles this correctly.

## Anti-Patterns

### Anti-Pattern 1: Adding a `type` Column to AllowlistEntry

**What people do:** Add `type: 'email' | 'domain'` to the existing `AllowlistEntry` model to handle domains in the same table.
**Why it's wrong:** Breaks all existing queries, tests, CSV import/export, and the email validation logic that assumes every entry is a valid email address. Requires changing a unique constraint that covers existing data.
**Do this instead:** New `DomainEntry` model as a sibling. Zero impact on existing AllowlistEntry code.

### Anti-Pattern 2: Fetching AuditLog and BookingAttempts in a Single Query

**What people do:** JOIN `audit_logs` and `booking_attempts` in one query to show a unified timeline.
**Why it's wrong:** The two tables have incompatible shapes and serve different user mental models (system-generated events vs user-initiated changes). A JOIN produces awkward nulls and requires complex display logic.
**Do this instead:** Two separate API routes, two tabs in the UI. Each table is small enough that independent fetches are fine.

### Anti-Pattern 3: Validating Domain Format Only on the Client

**What people do:** Validate `company.com` format in the dialog component, skipping server-side validation.
**Why it's wrong:** API routes must validate independently — client validation is bypassed by direct API calls. Domain format validation belongs in the API route with a Zod schema.
**Do this instead:** Zod schema in the domains API route enforces valid domain format (regex: no `@`, no spaces, valid label structure). Mirror validation in the client dialog for UX only.

### Anti-Pattern 4: Storing Domains with a Leading `@`

**What people do:** Store `@company.com` (with the `@`) verbatim from user input.
**Why it's wrong:** Comparison logic must then strip `@` in the webhook handler, leading to inconsistency across check, display, and audit log.
**Do this instead:** Normalize at write time — strip leading `@` before storing. Display with `@` prefix in the UI by prepending in the React template. Webhook domain check splits on `@` and compares the right-hand side against stored domain strings directly.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Calendly Webhook | Existing POST handler modified | `domainEntries` added to the `include` on the existing allowlists fetch. No new webhook subscription needed. |
| PostgreSQL | New `domain_entries` table via Prisma migration | Foreign key to `allowlists.id` with CASCADE delete. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `AllowlistPage` ↔ domains API | RSC fetches on load; client components call API for mutations then `router.refresh()` | Same pattern as email entries today |
| `ActivityPage` ↔ audit-log API | Client tab component fetches on tab switch + page change | AuditLog data is read-only from UI perspective |
| Webhook handler ↔ DomainEntry | Via Prisma include in existing user fetch | No separate service layer needed |
| `TIER_LIMITS` in `utils.ts` ↔ domain API | API imports `TIER_LIMITS` to enforce per-tier domain count caps | Add `domainEntries` key to the constant |
| `AuditAction` enum ↔ domain mutations | Add `ADD_DOMAIN` / `REMOVE_DOMAIN` to existing Prisma enum | Requires schema migration |

## New vs Existing — Explicit Summary

| Item | New or Modified | Notes |
|------|----------------|-------|
| `prisma/schema.prisma` — `DomainEntry` model | NEW | New table, new relation on `Allowlist` |
| `prisma/schema.prisma` — `AuditAction` enum | MODIFY | Add `ADD_DOMAIN`, `REMOVE_DOMAIN` values |
| `src/lib/utils.ts` — `TIER_LIMITS` | MODIFY | Add `domainEntries` count per tier |
| `src/app/api/allowlists/[id]/domains/route.ts` | NEW | GET + POST |
| `src/app/api/allowlists/[id]/domains/[domainId]/route.ts` | NEW | DELETE |
| `src/app/api/dashboard/audit-log/route.ts` | NEW | GET paginated AuditLog |
| `src/app/api/dashboard/activity/route.ts` | EXTEND | Add date range filter params (optional) |
| `src/app/api/webhooks/calendly/route.ts` | MODIFY | Add domain check after email check |
| `src/app/(dashboard)/dashboard/allowlist/page.tsx` | MODIFY | Add domain section below email table |
| `src/app/(dashboard)/dashboard/activity/page.tsx` | MODIFY | Add tabs, extract to client components |
| `src/components/dashboard/domain-allowlist-section.tsx` | NEW | Domain list + add/delete UI |
| `src/components/dashboard/add-domain-dialog.tsx` | NEW | Dialog for domain input |
| `src/components/dashboard/activity-table.tsx` | NEW | Client table extracted from activity page |
| `src/components/dashboard/audit-log-table.tsx` | NEW | Allowlist change history table |

## Suggested Build Order

Dependencies drive this order:

1. **Schema + migration** — `DomainEntry` model, `AuditAction` enum extension, `TIER_LIMITS` update. Everything downstream depends on this.
2. **Domain API routes** — `/api/allowlists/[id]/domains/` CRUD. Build and test independently before UI exists.
3. **Webhook domain check** — Modify webhook handler to include and check `domainEntries`. Requires schema step complete. Existing webhook test file (`route.test.ts`) to extend.
4. **Domain UI** — `DomainAllowlistSection` + `AddDomainDialog` + wire into `AllowlistPage`. Depends on domain API routes.
5. **Audit log API** — `/api/dashboard/audit-log/` route. No schema dependency beyond what already exists.
6. **Activity log UI** — Extract `ActivityTable`, build `AuditLogTable`, add tabs to `ActivityPage`. Depends on audit log API.

Steps 2-3 and step 5 have no dependency on each other and can proceed in parallel.

## Sources

- Direct inspection of `/prisma/schema.prisma` (v1.1 state, 2026-03-26)
- Direct inspection of `/src/app/api/allowlists/[id]/entries/route.ts` (AuditLog write pattern)
- Direct inspection of `/src/app/api/allowlists/[id]/entries/[entryId]/route.ts` (delete + audit pattern)
- Direct inspection of `/src/app/api/webhooks/calendly/route.ts` (email allowlist check pattern)
- Direct inspection of `/src/app/api/dashboard/activity/route.ts` (existing activity API)
- Direct inspection of `/src/app/(dashboard)/dashboard/activity/page.tsx` (current activity UI)
- Direct inspection of `/src/app/(dashboard)/dashboard/allowlist/page.tsx` (current allowlist UI)
- Direct inspection of `/src/lib/utils.ts` (`TIER_LIMITS` structure)

---
*Architecture research for: Protectly v1.2 — domain allowlisting + activity log UI*
*Researched: 2026-03-26*

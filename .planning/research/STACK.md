# Stack Research

**Domain:** Protectly v1.2 — domain allowlisting and activity log UI
**Researched:** 2026-03-26
**Confidence:** HIGH — conclusions drawn from direct codebase inspection; no external library introductions required

---

## Context: What This Milestone Adds

Two features are in scope for v1.2:

1. **Domain allowlisting** — users add `@company.com` entries; the webhook processor checks invitee email domain against these entries in addition to exact-email allowlist entries.
2. **Activity log UI** — interactive filtering (status, date range) and pagination on the existing `/dashboard/activity` page; the API already supports these parameters.

**The verdict:** Zero new npm packages required. Both features are pure schema + API route + UI component work using the stack that already exists.

---

## Existing Stack (Do Not Re-Research)

| Capability | Package | Version |
|------------|---------|---------|
| Framework | `next` | 15.1.3 |
| ORM | `@prisma/client` + `prisma` | 5.7.1 |
| UI components | shadcn/ui (Radix primitives + Tailwind) | installed |
| Client data fetching | `@tanstack/react-query` | 5.17.0 |
| Form validation | `zod` | 3.22.4 |
| Date utilities | `date-fns` | 3.2.0 |
| Icons | `lucide-react` | 0.468.0 |
| Analytics | `posthog-js` + `posthog-node` | installed |
| Auth | `iron-session` | 8.0.1 |

---

## Recommended Stack for v1.2

### No New Packages

Neither feature requires a new dependency. The rationale follows.

---

## Feature 1: Domain Allowlisting

### What's Needed

**Schema change (Prisma):** Add a `DomainAllowlistEntry` model to the existing schema. Domain entries are structurally different from email entries — they match on `@domain.com` suffix rather than exact email equality — and conflating them into `AllowlistEntry` with a `type` field creates implicit coupling in the webhook processor. A separate model is cleaner.

```prisma
model DomainAllowlistEntry {
  id          String    @id @default(uuid())
  allowlistId String
  allowlist   Allowlist @relation(fields: [allowlistId], references: [id], onDelete: Cascade)

  domain      String    @db.VarChar(255)  // stored as "company.com" (no @ prefix)
  notes       String?   @db.Text
  addedById   String?
  addedBy     User?     @relation("DomainAddedByUser", fields: [addedById], references: [id], onDelete: SetNull)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([allowlistId, domain])
  @@index([domain])
  @@map("domain_allowlist_entries")
}
```

**Webhook processor change:** In the existing Calendly webhook handler (`/api/webhooks/calendly/route.ts`), the allowlist check currently queries `AllowlistEntry` by exact email. It needs to also query `DomainAllowlistEntry` by extracting the domain from `inviteeEmail` (everything after `@`) and checking for a match.

**API routes:** Standard CRUD using existing Next.js Route Handler + zod + Prisma patterns. No new patterns required.

**UI:** A domain tab or section on the existing allowlist page. Uses existing shadcn Table, Dialog, Input, Button components — same components as `AllowlistTable` and `AddEmailDialog`.

**Domain validation:** Use a simple regex or split-on-`@` check in the zod schema. The `zod` `z.string().regex()` validator is sufficient. No dedicated domain-validation library needed.

### Why No New Package

The only conceivable addition would be a domain validation library (e.g., `is-valid-domain`). This is unnecessary: the validation requirement is "non-empty string, no `@`, contains at least one `.`" — a 10-character regex covers this. Adding a package for logic this simple adds maintenance surface for no benefit.

---

## Feature 2: Activity Log UI

### What's Needed

**Client component:** Convert the activity page from a server-rendered static list to a page that uses `useQuery` (TanStack Query, already installed) to call the existing `/api/dashboard/activity` endpoint with `status` and `page` query params.

**Status filter:** A `<Select>` dropdown (Radix `@radix-ui/react-select`, already installed via shadcn) to set the status filter: All / Approved / Rejected / Rate Limited.

**Pagination controls:** Previous / Next buttons updating the `page` param. Standard `useState` + `useQuery` pattern. No pagination library needed — the API already returns `totalPages`.

**Search (optional):** The activity API does not currently support email search — only the allowlist entries API does. If search is desired, it needs to be added to the API query (`WHERE inviteeEmail ILIKE %search%`), but this is a Prisma `where` clause addition, not a new library.

**Date range filter (optional):** The API uses `retentionDays` from tier limits, not an explicit date range parameter. If a date range picker is needed, the existing `date-fns` library handles date arithmetic. For a date picker UI, `@radix-ui/react-popover` (already installed as a shadcn dependency) + a simple calendar grid component built with Tailwind is sufficient; no need for `react-datepicker` or `react-day-picker`.

### Why No New Package

TanStack Query v5 is already installed and used via `query-provider.tsx`. The UI components for filtering are all covered by the existing Radix + shadcn installation. The API endpoint is already written and supports pagination and status filtering.

---

## Integration Points

### Domain Check in Webhook Processor

The webhook processor currently does:
```typescript
const entry = await prisma.allowlistEntry.findFirst({
  where: { allowlistId, email: inviteeEmail.toLowerCase() }
})
```

After this change it needs to also check:
```typescript
const domain = inviteeEmail.split('@')[1]?.toLowerCase()
const domainEntry = domain
  ? await prisma.domainAllowlistEntry.findFirst({
      where: { allowlistId, domain }
    })
  : null

const isApproved = !!entry || !!domainEntry
```

This is a pure Prisma query addition. No library changes.

### TIER_LIMITS in lib/utils.ts

Domain allowlist entries may need their own tier limit (e.g., max domains per tier). This is a constant addition to the existing `TIER_LIMITS` object — no library change.

### AuditLog for Domain Changes

The existing `AuditLog` model uses `targetEmail` for the subject of the action. Domain additions should use a new `AuditAction` enum value (`ADD_DOMAIN`, `REMOVE_DOMAIN`) and store the domain in `targetEmail` (semantically reused, or rename in schema). This is a schema enum extension — no library change.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `is-valid-domain` or `validate.js` | Domain validation is a 10-char regex; library adds dependency for trivial logic | `zod` `.regex(/^[a-z0-9][a-z0-9\-.]+\.[a-z]{2,}$/)` inline |
| `react-datepicker` or `react-day-picker` | Heavy UI library for an optional feature; Radix Popover + Tailwind grid is sufficient if date range filter is needed | Inline calendar component or defer date range filtering entirely |
| `react-table` / `@tanstack/react-table` | The activity log is a simple list, not a sortable/resizable data grid; current shadcn Table covers the need | Existing shadcn Table |
| `swr` | Redundant with TanStack Query already installed | `@tanstack/react-query` (already installed) |
| Any pagination library | The API returns `totalPages`; Previous/Next with `useState` is 10 lines | Native `useState` + `useQuery` |

---

## Prisma Migration Notes

Adding `DomainAllowlistEntry` requires:
```bash
npx prisma migrate dev --name add-domain-allowlist
```

The migration is non-destructive (additive only). No existing data is affected. The new table starts empty. Railway (production DB) runs `prisma migrate deploy` on deploy via the existing `postinstall` → `prisma generate` flow, but migrations themselves must be deployed separately via CI or manual `prisma migrate deploy`.

---

## Environment Variables

No new environment variables required.

---

## Sources

- Direct codebase inspection: `prisma/schema.prisma`, `package.json`, `src/app/api/webhooks/calendly/route.ts`, `src/app/api/dashboard/activity/route.ts`, `src/app/(dashboard)/dashboard/activity/page.tsx`, `src/components/dashboard/allowlist-table.tsx` — HIGH confidence (primary source)
- `@tanstack/react-query` v5 docs: pagination and `useQuery` with dynamic params — existing installation confirmed in `package.json`
- Prisma schema relations: separate model vs discriminated union — standard Prisma pattern, no external source needed

---

*Stack research for: Protectly v1.2 — domain allowlisting and activity log UI*
*Researched: 2026-03-26*

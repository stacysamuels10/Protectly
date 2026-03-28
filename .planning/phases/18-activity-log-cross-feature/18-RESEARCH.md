# Phase 18: Activity Log + Cross-Feature - Research

**Researched:** 2026-03-27
**Domain:** Next.js 15 client components, URL state management, React debounce, cross-feature allowlist actions
**Confidence:** HIGH

## Summary

Phase 18 refactors the existing SSR activity page into an interactive client component. The backend is almost entirely ready: the `/api/dashboard/activity` route already supports `status`, `page`, and `limit` query params and returns `rejectionReason`. The only backend change needed is adding a `search` query param for ACTV-04 and returning per-status counts for the tab badges. The allowlist POST endpoints for emails and domains are fully implemented and follow audit-first patterns.

The front-end work is substantial: a `'use client'` component consumes the activity API, manages URL search params via `useSearchParams` + `useRouter` from `next/navigation`, debounces the email search input, renders pill tab filters with count badges, numbered pagination, inline rejection reason subtitles, and a dropdown button on rejected rows that POSTs to the allowlist entry/domain endpoints. Toast notifications use the existing `useToast` hook backed by `@radix-ui/react-toast`.

A `tabs.tsx` UI primitive needs to be created (wrapping `@radix-ui/react-tabs@1.1.13`, already installed). All other UI primitives (Badge, Card, DropdownMenu, Button, Input, Toast) exist.

**Primary recommendation:** Build one `ActivityLogClient` component that owns all URL state. The server wrapper (`page.tsx`) fetches the user's allowlist ID via Prisma and passes it as a prop so the client component can call the allowlist POST endpoints without a separate round-trip.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Status filter as horizontal pill tabs (All / Approved / Rejected / Rate Limited) with count badges on each tab, displayed above the activity table
- **D-02:** Search input positioned beside filter tabs on the same row (tabs left, search right) — compact single-row toolbar
- **D-03:** Debounced live search (300ms debounce) filtering by invitee email — no submit button needed
- **D-04:** Filter status, search query, and page number all persisted as URL search params (`?status=REJECTED&q=john&page=2`) — shareable, survives refresh
- **D-05:** Rejection reason shown as inline muted subtitle text below the email/name line on rejected rows — always visible, no click needed (e.g. "Reason: Not on allowlist")
- **D-06:** Approved rows do NOT show approval reasons
- **D-07:** Classic numbered page pagination at bottom of table (< 1 2 3 ... 10 >) with "Showing X-Y of Z" count
- **D-08:** 25 items per page (matches existing API default)
- **D-09:** Inline "Add to allowlist" button with dropdown chevron on each rejected row — only visible on rejected status rows
- **D-10:** Dropdown offers two choices: "Add email (user@bad.com)" or "Add domain (@bad.com)" — fulfills XFEAT-02
- **D-11:** On success: toast notification ("Added user@bad.com to allowlist") and button changes to "Added" (disabled state). Row stays in place.
- **D-12:** Uses existing POST `/api/allowlists/[id]/entries/` for email adds and POST `/api/allowlists/[id]/domains/` for domain adds

### Claude's Discretion

- Loading skeleton/spinner design while fetching data
- Exact debounce implementation (useCallback + setTimeout vs lodash debounce vs useDeferredValue)
- Responsive layout adjustments for mobile (tabs may wrap to second row)
- Empty state for filtered views with no results vs overall empty state
- Toast library choice (existing pattern or new)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACTV-01 | User can filter activity log by status (All / Approved / Rejected / Rate Limited) | D-01: Pill tabs; URL param `?status=`; existing API supports `status` filter already |
| ACTV-02 | User can see the rejection reason for rejected bookings | D-05: Inline subtitle; API already returns `rejectionReason` in response — no backend changes |
| ACTV-03 | User can paginate through activity log beyond 100 items | D-07/D-08: Numbered pagination; existing API supports `page`/`limit` params |
| ACTV-04 | User can search activity log by email address | D-03: Debounced search; API needs `search` query param added (currently missing) |
| XFEAT-01 | User can add a rejected booking's email to allowlist from activity log | D-09/D-11: Dropdown button; POST to existing entries endpoint |
| XFEAT-02 | When adding from rejected row, user can choose email or full domain | D-10: Two dropdown menu items — email vs @domain |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/navigation | 15.5.9 (Next.js) | `useSearchParams`, `useRouter`, `usePathname` | Official Next.js 15 URL state API for client components |
| @radix-ui/react-tabs | 1.1.13 (installed) | Filter tab primitive | Already in package.json; used elsewhere in codebase as Radix pattern |
| @radix-ui/react-dropdown-menu | 2.0.6 (installed) | "Add to allowlist" split button | Already in codebase as `dropdown-menu.tsx`; used in Phase 17 |
| @radix-ui/react-toast | 1.1.5 (installed) | Success/error notifications | Already in codebase as `toast.tsx` + `useToast` hook |
| React (19.0.0) | 19.0.0 | `useCallback`, `useRef`, `useState` | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.468.0 | ChevronDown for split button, Search icon, spinner | Already used throughout dashboard |
| date-fns | 3.2.0 | `formatDateTime` (re-use existing helper) | Already in `src/lib/utils.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useSearchParams` + `useRouter.replace` | `nuqs` library | nuqs is simpler but adds a dependency; `next/navigation` is zero-dependency and already mocked in test setup |
| `setTimeout` debounce in `useCallback` | `lodash.debounce` | lodash adds ~70KB; manual 300ms debounce in a `useRef`/`useCallback` is idiomatic for this scope |
| Radix Tabs | Custom pill buttons with active state | Radix handles keyboard nav and accessibility automatically; package is already installed |

**Installation:** No new packages required — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(dashboard)/dashboard/activity/
│   └── page.tsx                      # Thin server wrapper — fetches allowlistId, passes to client
├── components/dashboard/
│   ├── activity-log-client.tsx       # 'use client' — owns all state and API calls
│   ├── activity-log-client.test.tsx  # Component tests (filter, search, pagination, add-to-allowlist)
│   ├── activity-filters.tsx          # Pill tab row + search input (sub-component, could be inline)
│   └── add-to-allowlist-button.tsx   # Split dropdown button for rejected rows + tests
├── components/ui/
│   └── tabs.tsx                      # NEW: Radix Tabs primitive wrapper (like dropdown-menu.tsx)
└── app/api/dashboard/activity/
    └── route.ts                      # Add `search` query param (ACTV-04 backend fix)
```

### Pattern 1: Server Wrapper Passes Allowlist ID to Client

**What:** `page.tsx` stays a server component. It calls `getCurrentUser()` + `prisma.allowlist.findFirst` to resolve the user's global allowlist ID and passes it as a prop to `ActivityLogClient`. This avoids a client-side fetch just to discover the allowlist ID, and prevents the activity client component from needing any Prisma access.

**When to use:** Whenever a client component needs stable server-only data (user ID, allowlist ID) that never changes per-interaction.

**Example:**
```typescript
// src/app/(dashboard)/dashboard/activity/page.tsx
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ActivityLogClient } from '@/components/dashboard/activity-log-client'

export default async function ActivityPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const allowlist = await prisma.allowlist.findFirst({
    where: { userId: user.id, isGlobal: true },
    select: { id: true },
  })

  return <ActivityLogClient allowlistId={allowlist?.id ?? null} />
}
```

### Pattern 2: URL Search Param State Management

**What:** All interactive state (status filter, search query, page) lives in the URL. `useSearchParams` reads current values on mount and after navigation. Changes are written back via `router.replace` (not `router.push`) to avoid polluting browser history for each keystroke.

**When to use:** Any filter/search/pagination that should survive page refresh and be shareable.

**Example:**
```typescript
// Source: Next.js 15 official docs — useSearchParams
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useRef } from 'react'

export function ActivityLogClient({ allowlistId }: { allowlistId: string | null }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const status = searchParams.get('status') ?? 'ALL'
  const query = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '') params.delete(key)
      else params.set(key, val)
    })
    router.replace(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  // ...
}
```

**Critical note for Next.js 15:** `useSearchParams()` must be wrapped in `<Suspense>` in the parent to avoid build errors. The server wrapper must wrap `<ActivityLogClient>` in `<Suspense fallback={...}>`.

### Pattern 3: Debounced Search with useRef

**What:** A `useRef` holds the timeout ID. Each keystroke clears the previous timeout and sets a new 300ms timeout before calling `updateParams`. This is zero-dependency and matches the project's avoidance of lodash.

**Example:**
```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleSearchChange = useCallback((value: string) => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    updateParams({ q: value || null, page: null }) // reset to page 1 on new search
  }, 300)
}, [updateParams])
```

### Pattern 4: Add-to-Allowlist Split Button

**What:** Uses existing `DropdownMenu` + `DropdownMenuItem` from `src/components/ui/dropdown-menu.tsx`. The trigger is a Button with a ChevronDown. Local per-row state tracks `added: 'email' | 'domain' | null` and `loading: boolean`. On success, button becomes "Added" (disabled). Uses `useToast` for feedback.

**Example:**
```typescript
// Source: existing dropdown-menu.tsx pattern, add-domain-dialog.tsx toast pattern
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'

async function handleAddEmail(allowlistId: string, email: string) {
  const res = await fetch(`/api/allowlists/${allowlistId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails: [email] }),
  })
  // ...
}
```

### Pattern 5: Tabs UI Component

**What:** New `src/components/ui/tabs.tsx` wrapping `@radix-ui/react-tabs` — same boilerplate pattern as `dropdown-menu.tsx`. Exports `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.

**When to use:** The filter row uses `TabsList` + `TabsTrigger`. Tab value is the status string (`ALL`, `APPROVED`, `REJECTED`, `RATE_LIMITED`).

### Anti-Patterns to Avoid

- **Direct Prisma from client component:** Client components cannot call Prisma. The allowlist ID must be resolved server-side in `page.tsx` and passed as a prop.
- **router.push for every filter change:** `router.push` adds a history entry per keystroke. Use `router.replace` for filter/search/pagination updates.
- **SSR status counts via new API call:** The activity API only returns counts for the filtered result, not global per-status counts needed by tab badges. Add a `statusCounts` field to the activity API response (same `groupBy` query as the old SSR page) so the client gets counts in one request.
- **Resetting page when changing status:** When the user switches status tabs, reset `page` to `1` — otherwise page 5 of APPROVED may have no results when switching to REJECTED.
- **Missing `<Suspense>` wrapper:** In Next.js 15, `useSearchParams()` in a client component requires the component to be wrapped in `<Suspense>`. Omitting this causes a build warning and potential hydration issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom state + portal | `useToast` + `toast()` from `@/components/ui/use-toast` | Already implemented, supports `variant: 'success'` and `variant: 'destructive'` |
| Dropdown split button | Custom CSS dropdown | `DropdownMenu*` from `@/components/ui/dropdown-menu` | Radix handles focus trap, keyboard nav, portal positioning |
| Tab pill buttons | `<button>` with active class logic | `Tabs`/`TabsList`/`TabsTrigger` from new `tabs.tsx` | Radix handles keyboard nav, aria-selected, roving focus |
| URL state serialization | Manual history.pushState | `useSearchParams` + `router.replace` | Next.js 15 built-in, handles SSR hydration correctly |
| Email domain extraction | Regex split | `email.split('@')[1]` — trivial, but do it inline in the component | No library needed for a single split |

**Key insight:** All infrastructure (toast, dropdown, API endpoints) is already built. The work is purely front-end composition and one small API extension (`search` param + `statusCounts` in response).

---

## API Gap Analysis

### Activity API — Changes Required

The existing `GET /api/dashboard/activity` needs two additions:

**1. `search` query param (ACTV-04):**
```typescript
const search = searchParams.get('search') ?? ''

const where = {
  userId: user.id,
  createdAt: { gte: cutoffDate },
  ...(status && { status }),
  ...(search && {
    inviteeEmail: { contains: search, mode: 'insensitive' as const },
  }),
}
```

**2. `statusCounts` in response (needed for tab badge counts — D-01):**
The current SSR page computed these via a `groupBy` query. The refactored client needs them from the API. Add a parallel `groupBy` query and include it in the response:
```typescript
const [attempts, total, countsByStatus] = await Promise.all([
  prisma.bookingAttempt.findMany({ where, ... }),
  prisma.bookingAttempt.count({ where }),
  prisma.bookingAttempt.groupBy({
    by: ['status'],
    where: { userId: user.id, createdAt: { gte: cutoffDate } }, // always unfiltered counts
    _count: true,
  }),
])

// Response adds:
statusCounts: {
  APPROVED: countsByStatus.find(c => c.status === 'APPROVED')?._count ?? 0,
  REJECTED: countsByStatus.find(c => c.status === 'REJECTED')?._count ?? 0,
  RATE_LIMITED: countsByStatus.find(c => c.status === 'RATE_LIMITED')?._count ?? 0,
}
```

Note: The `statusCounts` query uses unfiltered `where` (userId + date only, no status/search) so tab badges always show total counts, not filtered counts.

### Allowlist ID Resolution

The activity client must know the user's allowlist ID to call `/api/allowlists/[id]/entries` and `/api/allowlists/[id]/domains`. Resolution options:

- **Recommended (server prop):** Resolve in `page.tsx` via `prisma.allowlist.findFirst({ where: { userId, isGlobal: true }, select: { id: true } })` — already the pattern used in `allowlist/page.tsx`.
- **Alternative (client fetch):** Call `GET /api/allowlists` on mount — adds a round-trip and loading complexity. Avoid.

---

## Common Pitfalls

### Pitfall 1: useSearchParams Suspense Requirement (Next.js 15)
**What goes wrong:** Build error or "Missing Suspense boundary" warning. In Next.js 13+, components that call `useSearchParams()` must be wrapped in `<Suspense>`.
**Why it happens:** Next.js pre-renders pages statically by default; `useSearchParams` opts out and requires explicit Suspense.
**How to avoid:** In `page.tsx`, wrap `<ActivityLogClient>` in `<Suspense fallback={<ActivityLogSkeleton />}>`.
**Warning signs:** `Warning: A component suspended while responding to synchronous input` in console.

### Pitfall 2: Stale Closure in Debounce
**What goes wrong:** Debounce callback captures stale `updateParams` reference, causing wrong URL updates after rapid typing.
**Why it happens:** `useCallback` dependency array not including `updateParams`.
**How to avoid:** Either include `updateParams` in the `useCallback` dependency array, or use a `useRef` to always hold the latest callback (ref pattern).
**Warning signs:** URL search param updates lag or show wrong previous values.

### Pitfall 3: Tab Badge Counts Show Filtered Numbers
**What goes wrong:** Switching to "Rejected" tab changes both the row filter AND the badge count on "Approved" (count shows 0 instead of total).
**Why it happens:** If `statusCounts` is computed from the same filtered query as the rows, it only reflects the current filter.
**How to avoid:** Always compute `statusCounts` with an unfiltered where clause (userId + date cutoff only — no status/search filter).
**Warning signs:** Tab badge for "All" shows same number as the active tab count.

### Pitfall 4: ResizeObserver Not Mocked as Class
**What goes wrong:** `DropdownMenu` tests fail with `TypeError: ResizeObserver is not a constructor`.
**Why it happens:** The global setup mocks `ResizeObserver` as a plain vi.fn() (current `setup.ts` does this correctly already), but if a test file overrides it as a function, Radix's floating-ui will throw.
**How to avoid:** The existing `setup.ts` already mocks `ResizeObserver` with `.observe`, `.unobserve`, `.disconnect`. Do not override this in individual test files.
**Warning signs:** Test file works in isolation but fails when run with global setup.

### Pitfall 5: Domains API Rejects Free Email Providers with 400
**What goes wrong:** User clicks "Add domain (@gmail.com)" — the API returns `400` with "is a free email provider". The client must handle this as an error toast, not a silent no-op.
**Why it happens:** `domains/route.ts` explicitly blocks free email providers and returns early with `status: 400`.
**How to avoid:** In `handleAddDomain`, check `response.ok`. If false, read `data.error` and show a destructive toast with the message. This matches what `AddDomainDialog` already does.
**Warning signs:** Domain add silently does nothing when user tries to add a Gmail address.

### Pitfall 6: Page Number Not Reset on Filter Change
**What goes wrong:** User is on page 3, switches to "Rejected" tab — API call is `?status=REJECTED&page=3` — may return 0 results.
**Why it happens:** URL param update for status doesn't clear `page`.
**How to avoid:** In `updateParams` call for status/search changes, always include `page: null` (or `page: '1'`) to reset pagination.
**Warning signs:** Empty table when switching filters while on a non-first page.

---

## Code Examples

### Tabs UI Component (new file)
```typescript
// src/components/ui/tabs.tsx
// Source: @radix-ui/react-tabs docs pattern, mirroring existing Radix wrappers in this project
'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

### useToast call pattern (from existing add-domain-dialog.tsx)
```typescript
// Source: src/components/dashboard/add-domain-dialog.tsx (existing)
const { toast } = useToast()

toast({ title: 'Added to allowlist', variant: 'success' })
toast({ title: 'Error', description: data.error, variant: 'destructive' })
```

### Mock pattern for useSearchParams in tests
```typescript
// Source: src/components/dashboard/add-domain-dialog.test.tsx (existing)
// Override useSearchParams to return specific params
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams('status=REJECTED&page=1'),
  usePathname: () => '/dashboard/activity',
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSR direct Prisma in page component | Client component + API fetch | Phase 18 (this phase) | Enables live filtering without full page reload |
| `pages/` router `router.query` | `useSearchParams()` from `next/navigation` | Next.js 13+ App Router | App Router only; no `router.query` equivalent |
| `router.push` for all navigation | `router.replace` for filter updates | Best practice | Avoids polluting browser history with filter states |

**Deprecated/outdated:**
- Direct `prisma.*` calls in the activity `page.tsx` server component: will be moved to the API route — the SSR `getActivityData` function is deleted.
- Hard-coded `take: 100` limit in the old SSR page: superseded by paginated API with 25-per-page.

---

## Open Questions

1. **Stats cards (Approved/Rejected/Rate Limited count cards) — keep or remove?**
   - What we know: The current SSR page renders three stats cards above the table. The CONTEXT.md says "Stats cards — keep these, they work well."
   - What's unclear: The stats cards show total counts (all time within retention window). Once we add `statusCounts` to the activity API response, the client has these numbers. The stats cards can be rendered from `statusCounts` without a separate API call.
   - Recommendation: Keep stats cards. Populate from `statusCounts` in the API response.

2. **`search` param name — `q` (URL) vs `search` (API)?**
   - What we know: CONTEXT.md D-04 shows `?q=john` in the URL. The API parameter should probably be `search` to match the existing allowlist entries API.
   - What's unclear: Whether the client should use the same param name in URL and API, or different names.
   - Recommendation: Use `?q=` in the URL (user-facing, shorter) and pass it as `search=` to the API — map in the client component. This is consistent with common practice (Google uses `q=`).

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is purely front-end component work and a minor API extension within the existing Next.js/Prisma stack).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 + @testing-library/react 16.3.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTV-01 | Clicking status tab updates URL `?status=` param | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-01 | Tab badge counts display total per-status counts | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-02 | Rejected rows show "Reason: X" subtitle text | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-02 | Approved rows do NOT show reason text | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-03 | Pagination controls render and clicking updates `?page=` | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-03 | "Showing X-Y of Z" count is displayed | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| ACTV-04 | Typing in search input debounces and updates `?q=` after 300ms | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | Wave 0 |
| XFEAT-01 | "Add to allowlist" button appears on REJECTED rows only | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | Wave 0 |
| XFEAT-01 | Clicking "Add email" POSTs to `/api/allowlists/[id]/entries` | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | Wave 0 |
| XFEAT-01 | On success, button shows "Added" (disabled) and toast fires | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | Wave 0 |
| XFEAT-02 | Dropdown offers "Add email (user@x.com)" and "Add domain (@x.com)" items | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | Wave 0 |
| XFEAT-02 | Clicking "Add domain" POSTs to `/api/allowlists/[id]/domains` | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | Wave 0 |
| ACTV-04 | Activity API route returns filtered results when `search` param provided | unit | `npx vitest run src/app/api/dashboard/activity/` | Wave 0 (extend existing route tests if any, or create) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/dashboard/activity-log-client.test.tsx src/components/dashboard/add-to-allowlist-button.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/dashboard/activity-log-client.test.tsx` — covers ACTV-01, ACTV-02, ACTV-03, ACTV-04
- [ ] `src/components/dashboard/add-to-allowlist-button.test.tsx` — covers XFEAT-01, XFEAT-02
- [ ] `src/components/ui/tabs.tsx` — new file (no tests needed; it is a thin Radix wrapper like all other UI primitives)

*(Existing test infrastructure covers framework, setup, and mocking patterns — no framework gaps.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `src/app/api/dashboard/activity/route.ts` — confirmed existing params (`status`, `page`, `limit`), confirmed `rejectionReason` in response, confirmed no `search` param
- Direct source code inspection: `src/app/api/allowlists/[id]/entries/route.ts` — confirmed POST body shape `{ emails: string[] }`, audit-first pattern, PostHog tracking
- Direct source code inspection: `src/app/api/allowlists/[id]/domains/route.ts` — confirmed POST body shape `{ domains: string[] }`, free email provider block, returns 400 for blocked domains
- Direct source code inspection: `src/components/ui/` — confirmed Toast/useToast exists, DropdownMenu exists, no Tabs component exists
- Direct source code inspection: `src/test/setup.ts` — confirmed mocking patterns for next/navigation, ResizeObserver
- Direct source code inspection: `package.json` — confirmed `@radix-ui/react-tabs@^1.0.4` installed (resolved to 1.1.13), Next.js 15.5.9, Vitest 4.0.16
- Direct source code inspection: `src/components/dashboard/add-domain-dialog.test.tsx` — confirmed test patterns: fetch mock, useToast mock, router.refresh mock, vi.hoisted pattern

### Secondary (MEDIUM confidence)
- Next.js 15 App Router docs pattern: `useSearchParams` requires `<Suspense>` wrapper — consistent with Next.js 13+ App Router behavior

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via node_modules inspection
- Architecture: HIGH — based on direct code inspection of canonical refs and existing patterns
- Pitfalls: HIGH — based on existing test files (ResizeObserver class mock note in STATE.md) and direct API code inspection
- API gaps: HIGH — confirmed by reading route.ts source directly

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable stack, no fast-moving dependencies)

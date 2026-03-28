# Phase 17: Domain UI - Research

**Researched:** 2026-03-26
**Domain:** Next.js 15 dashboard UI — React client components, dialog patterns, badge variants, server action / fetch patterns
**Confidence:** HIGH

## Summary

Phase 17 adds domain entry management to the existing allowlist page. The backend APIs from Phase 16 are fully implemented: `POST /api/allowlists/[id]/domains` and `DELETE /api/allowlists/[id]/domains/[domainId]`. Both return the shape the UI needs. The Prisma model is `DomainEntry { id, domain, allowlistId, createdAt }` — no `name` or `notes` fields (domain entries are simpler than email entries).

The allowlist page (`src/app/(dashboard)/dashboard/allowlist/page.tsx`) is a Next.js server component that queries `prisma.allowlist.findFirst` and passes data to client components. Currently it only fetches `entries` (email entries). It must be extended to also fetch `domainEntries`. The existing `AllowlistTable` is email-only and displays email, name, notes. Domain entries need separate treatment: a new `DomainAllowlistSection` component (or integration into the existing table) plus an `AddDomainDialog`.

The design pattern to follow is identical to `AddEmailDialog` — a shadcn Dialog with a controlled `open` state, form submission via `fetch`, toast feedback, and `router.refresh()` to revalidate server data. The scope warning (DOM-01 success criterion) is a `<p>` or `<Alert>` inside the dialog body, not a separate step.

**Primary recommendation:** Build `AddDomainDialog` as a standalone client component mirroring `AddEmailDialog`. Add a separate `DomainAllowlistSection` table below the email table on the allowlist page. Use the existing `Badge` component (`variant="secondary"` or custom inline className) to visually distinguish domain entries in both sections.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-01 | User can add a domain entry (@company.com) to their allowlist | `POST /api/allowlists/[id]/domains` exists; accepts `{ domains: string[] }`, normalizes `@company.com` → `company.com`; AddDomainDialog calls it |
| DOM-02 | User can delete a domain entry from their allowlist | `DELETE /api/allowlists/[id]/domains/[domainId]` exists; returns `{ success: true }`; DomainAllowlistSection calls it |
| DOM-03 | User can see domain entries in their allowlist UI with visual distinction from email entries | Existing `Badge` component has `variant` system (default/secondary/success/warning/destructive/outline/error); a "Domain" badge on each row achieves visual separation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.1.3 | App Router, server components, `router.refresh()` | Project stack |
| react | ^19.0.0 | Client component hooks (useState, useRouter) | Project stack |
| lucide-react | ^0.468.0 | Icons: `Globe`, `Plus`, `Trash2`, `Loader2`, `AlertTriangle` | Already used across dashboard |
| class-variance-authority | ^0.7.0 | Badge variants | Already in badge.tsx |

### Supporting (already installed — no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.1 | Component unit tests | AddDomainDialog, DomainAllowlistSection |
| vitest | ^4.0.16 | Test runner | All tests |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(dashboard)/dashboard/allowlist/page.tsx   # Update: fetch domainEntries, render new section + dialog button
├── components/dashboard/
│   ├── add-domain-dialog.tsx                      # NEW: AddDomainDialog client component
│   ├── domain-allowlist-section.tsx               # NEW: domain table + delete handler
│   └── allowlist-table.tsx                        # UNCHANGED (email-only, no modification needed)
```

### Pattern 1: Dialog Component (mirrors AddEmailDialog)

**What:** Controlled Dialog with open/setOpen state, form submit calls fetch, toast on success/error, router.refresh() on success.

**When to use:** Any add/create action in this dashboard.

**Example (from existing `add-email-dialog.tsx`):**
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Loader2 } from 'lucide-react'

interface AddDomainDialogProps {
  allowlistId: string
}

export function AddDomainDialog({ allowlistId }: AddDomainDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [domain, setDomain] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`/api/allowlists/${allowlistId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [domain.trim()] }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain')
      }
      // handle duplicates, invalid, added...
      toast({ title: 'Domain added', description: `@${data.addedDomains[0]} added.`, variant: 'success' })
      setOpen(false)
      setDomain('')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }
  // render Dialog...
}
```

### Pattern 2: Scope Warning in Dialog

**What:** A static informational callout inside the dialog body (above the input), displayed unconditionally once the dialog is open.

**When to use:** DOM-01 success criterion requires a scope warning — "all bookings from that domain will be approved."

**Example:**
```tsx
// Inside DialogContent, above the input field
<div className="rounded-md bg-warning-light p-3 text-sm text-warning flex gap-2 items-start">
  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
  <p>All bookings from this domain will be approved. Only add corporate domains you trust.</p>
</div>
```

**Alternative:** Use `variant="warning"` on a `Badge` or a plain `<p className="text-sm text-muted-foreground">` if a lighter tone is preferred.

### Pattern 3: Domain Entry Row with Type Badge

**What:** Each domain row in the table shows a `<Badge>` to indicate it is a domain entry (not an email entry), providing visual distinction (DOM-03).

**When to use:** Every row in DomainAllowlistSection.

**Example:**
```tsx
// In domain table row
<TableCell>
  <div className="flex items-center gap-2">
    <Globe className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium">@{entry.domain}</span>
    <Badge variant="secondary">Domain</Badge>
  </div>
</TableCell>
```

### Pattern 4: Allowlist Page — Fetching Domain Entries

**What:** The server component `page.tsx` must be updated to include `domainEntries` in the Prisma query.

**Current query:**
```typescript
const allowlist = await prisma.allowlist.findFirst({
  where: { userId, isGlobal: true },
  include: {
    entries: { orderBy: { createdAt: 'desc' } },
    _count: { select: { entries: true } },
  },
})
```

**Updated query:**
```typescript
const allowlist = await prisma.allowlist.findFirst({
  where: { userId, isGlobal: true },
  include: {
    entries: { orderBy: { createdAt: 'desc' } },
    domainEntries: { orderBy: { createdAt: 'desc' } },
    _count: { select: { entries: true, domainEntries: true } },
  },
})
```

Then pass `domainEntries` and `allowlist.id` to `DomainAllowlistSection`, and add an `AddDomainDialog` button in the header action bar.

### Anti-Patterns to Avoid

- **Reusing AllowlistTable for domain entries:** AllowlistTable expects `name`, `notes`, and `expiresAt` fields that `DomainEntry` doesn't have. Build a separate `DomainAllowlistSection` component.
- **Using `type="email"` input for domain field:** The domain input accepts `@company.com` format, not an email address. Use `type="text"` with a placeholder of `@company.com`.
- **Displaying domain without @ prefix:** The API stores the domain without `@` (normalized). The UI should display `@company.com` for clarity by prepending `@` in the render, not in the stored value.
- **Forgetting to handle the 400 free-email-provider error:** The API returns `{ error: "...free email provider..." }` with status 400 for gmail.com etc. The dialog must surface this as a toast error.
- **Calling router.refresh() on duplicate/invalid response:** Only call `router.refresh()` when `data.added > 0`. On duplicate or invalid, show a toast error and keep the dialog open.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog UI | Custom modal with portals | shadcn `Dialog` (already in `@/components/ui/dialog`) | Accessibility, focus trap, keyboard dismiss already handled |
| Toast notifications | Custom notification system | `useToast` from `@/components/ui/use-toast` | Consistent with rest of dashboard |
| Type badges | Custom CSS badge | `Badge` from `@/components/ui/badge` with existing variants | Already has `secondary`, `success`, `warning`, `default` variants |
| Domain input validation | Client-side regex | Let the API validate; show API error in toast | API already normalizes and validates; duplicating logic risks drift |
| Page data refresh | Manual state updates | `router.refresh()` from `next/navigation` | Triggers server component re-fetch — the established pattern in this codebase |

**Key insight:** This codebase has a clean pattern — client components call fetch, get a response, toast on result, and call `router.refresh()` for data updates. Don't diverge from this.

## Common Pitfalls

### Pitfall 1: Input type="email" Blocks @company.com Entry
**What goes wrong:** Using `type="email"` on the domain input causes browser validation to reject `@company.com` before the form submits — it's not a valid email address.
**Why it happens:** Browser email validation requires a local part before the `@`.
**How to avoid:** Use `type="text"` for the domain input. Placeholder: `@company.com`.
**Warning signs:** Form doesn't submit when user types `@company.com`.

### Pitfall 2: Domain Display Without @ Prefix Confuses Users
**What goes wrong:** The API stores `company.com` (without `@`). Displaying it raw looks like a plain domain, not distinguishable from email domains.
**Why it happens:** API normalizes by stripping `@` on intake.
**How to avoid:** In the UI render, always display `@${entry.domain}`.

### Pitfall 3: Page Doesn't Show Domain Entries After Add
**What goes wrong:** `router.refresh()` works only if the server component query includes `domainEntries`. If the page query isn't updated, the section shows empty even after adding.
**Why it happens:** The existing page query only fetches `entries` (email). `domainEntries` is not included.
**How to avoid:** Update `getAllowlistData()` in `page.tsx` to include `domainEntries` and update `_count`.

### Pitfall 4: Handling All API Response Shapes
**What goes wrong:** The POST domains API returns different shapes: `added > 0` (success), `duplicates` array (already exists), `invalid` array (bad format), or 400/403 for free-email-provider / tier limit.
**Why it happens:** The API is designed to batch-process domains, even though the UI only adds one at a time.
**How to avoid:** Check: `!response.ok` → throw with `data.error`. Then check `data.added > 0` for success, `data.duplicates.length > 0` for "already exists", `data.invalid.length > 0` for bad format.

### Pitfall 5: Scope Warning Tone
**What goes wrong:** If the scope warning looks like an error/blocking message, users may be confused or alarmed.
**Why it happens:** Warning-colored UI elements are usually associated with blocking errors.
**How to avoid:** Use informational tone. Label it "Heads up" or "Note", not "Warning". Use muted or subtle styling rather than `destructive`.

## Code Examples

### DomainAllowlistSection delete handler
```typescript
// Source: mirrors allowlist-table.tsx delete pattern
const handleDelete = async (domainId: string, domain: string) => {
  if (!confirm(`Remove @${domain} from your allowlist?`)) return
  setDeleting(domainId)
  try {
    const response = await fetch(
      `/api/allowlists/${allowlistId}/domains/${domainId}`,
      { method: 'DELETE' }
    )
    if (!response.ok) throw new Error('Failed to delete domain')
    toast({ title: 'Domain removed', description: `@${domain} has been removed.` })
    router.refresh()
  } catch {
    toast({ title: 'Error', description: 'Failed to remove domain. Please try again.', variant: 'destructive' })
  } finally {
    setDeleting(null)
  }
}
```

### Allowlist page — updated query
```typescript
// Source: page.tsx getAllowlistData — extend existing include
const allowlist = await prisma.allowlist.findFirst({
  where: { userId, isGlobal: true },
  include: {
    entries: { orderBy: { createdAt: 'desc' } },
    domainEntries: { orderBy: { createdAt: 'desc' } },
    _count: { select: { entries: true, domainEntries: true } },
  },
})
```

### Domain entry display
```tsx
// In DomainAllowlistSection table body
{domainEntries.map((entry) => (
  <TableRow key={entry.id}>
    <TableCell>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">@{entry.domain}</span>
        <Badge variant="secondary">Domain</Badge>
      </div>
    </TableCell>
    <TableCell>{formatDate(entry.createdAt)}</TableCell>
    <TableCell>
      <DropdownMenu>
        {/* ... delete action */}
      </DropdownMenu>
    </TableCell>
  </TableRow>
))}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Page-level state management | `router.refresh()` triggers server component re-fetch | Next.js 13+ App Router | No client state needed for allowlist data |
| Manual modal HTML | shadcn Dialog with Radix UI primitives | Since project start | Accessibility built-in |

## Open Questions

1. **Where does the "Add Domain" button live on the allowlist page?**
   - What we know: The header has `CsvImportButton`, `CsvExportButton`, `AddEmailDialog` in a flex row.
   - What's unclear: Should `AddDomainDialog` be alongside these, or in a separate section header for the domain table?
   - Recommendation: Add it to the main header row alongside `AddEmailDialog`. Keeps the header consistent with the email workflow.

2. **Should the usage card show domain entry count separately?**
   - What we know: The current usage card shows `entries / limit emails`. Domain entries have their own tier limit.
   - What's unclear: Whether to show a second usage bar for domains or combine them.
   - Recommendation: Add a second row in the usage card for domain entries, mirroring the email entry display. This avoids confusing users about their limits.

3. **Empty state for domain section**
   - What we know: AllowlistTable has a rich empty state with an icon and an inline `AddEmailDialog` button.
   - What's unclear: Whether the domain section needs its own empty state or a simpler treatment.
   - Recommendation: Use a simple empty state with a `Globe` icon, brief description, and an inline `AddDomainDialog` trigger for consistency with the email table.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 + @testing-library/react ^16.3.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx src/components/dashboard/domain-allowlist-section.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOM-01 | AddDomainDialog submits POST with correct payload, handles success/duplicate/error | unit | `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx` | Wave 0 |
| DOM-01 | Scope warning is rendered in dialog | unit | `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx` | Wave 0 |
| DOM-02 | DomainAllowlistSection delete calls DELETE endpoint, shows toast, refreshes | unit | `npx vitest run src/components/dashboard/domain-allowlist-section.test.tsx` | Wave 0 |
| DOM-03 | Domain entries render with type badge/indicator visually distinct from email | unit | `npx vitest run src/components/dashboard/domain-allowlist-section.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx src/components/dashboard/domain-allowlist-section.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/dashboard/add-domain-dialog.test.tsx` — covers DOM-01 (add, scope warning, error handling)
- [ ] `src/components/dashboard/domain-allowlist-section.test.tsx` — covers DOM-02 (delete), DOM-03 (type badge)

*(Test infrastructure exists — vitest, @testing-library/react, setup.ts with router mock and ResizeObserver mock are all in place. Only the two new test files are missing.)*

## Sources

### Primary (HIGH confidence)
- `src/app/api/allowlists/[id]/domains/route.ts` — POST handler, request/response shape, validation rules, error codes
- `src/app/api/allowlists/[id]/domains/[domainId]/route.ts` — DELETE handler, response shape
- `src/app/(dashboard)/dashboard/allowlist/page.tsx` — Current page structure and Prisma query to extend
- `src/components/dashboard/add-email-dialog.tsx` — Exact pattern to replicate for AddDomainDialog
- `src/components/dashboard/allowlist-table.tsx` — Exact pattern to replicate for DomainAllowlistSection
- `src/components/ui/badge.tsx` — Available badge variants: default, secondary, destructive, outline, success, warning, error
- `prisma/schema.prisma` — DomainEntry model fields: `id`, `domain`, `allowlistId`, `createdAt`, `updatedAt`
- `src/lib/utils.ts` — TIER_LIMITS.domainEntries: FREE=10, PRO=100, BUSINESS=500, ENTERPRISE=Infinity

### Secondary (MEDIUM confidence)
- Project documentation (STATE.md, PROJECT.md) — confirmed Phase 16 APIs are complete; Phase 17 is UI only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — direct inspection of existing components and APIs; patterns are established
- Pitfalls: HIGH — sourced from direct codebase analysis (API shapes, field availability, page query gaps)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack, no external dependency changes expected)

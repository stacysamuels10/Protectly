# Phase 13: CSV Import & Export - Research

**Researched:** 2026-03-21
**Domain:** Browser CSV parsing (papaparse), native CSV generation, Next.js API routes, React file input, tier-gated feature UX
**Confidence:** HIGH

## Summary

This phase adds two capabilities to the allowlist page: a Pro+-gated CSV import flow and an unrestricted CSV export. The project already has `TIER_LIMITS.csvImport` defined in `src/lib/utils.ts` — the gate is already modelled. The existing POST endpoint at `/api/allowlists/[id]/entries` accepts `emails[]` arrays and handles deduplication and validation server-side, making it directly reusable for batch import by calling it in chunks. Export requires a new GET route that returns `text/csv` with a `Content-Disposition` attachment header; the frontend triggers a client-side download with no new page needed.

Client-side parsing with **papaparse** (currently v5.5.3 on npm, types available as `@types/papaparse`) is the right choice. It runs synchronously for files under ~50 MB, handles edge cases (quoted fields, BOM, Windows line endings), and is the ecosystem standard for browser CSV parsing. Parsing purely client-side avoids multipart file upload complexity and keeps the API surface clean.

For a 500-row file, the bottleneck is sequential per-entry DB writes in the existing POST handler. Batching into groups of 50 rows per API call keeps individual requests fast and gives the progress indicator natural update points. With 500 rows at 50/batch = 10 API calls, total time is well under any timeout threshold.

**Primary recommendation:** Use papaparse for client-side parsing, call the existing POST `/api/allowlists/[id]/entries` in batches of 50, add a dedicated GET export route, and wire tier-gate via `TIER_LIMITS[user.subscriptionTier].csvImport`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "Import CSV" button on allowlist page opens native file picker. No drag-and-drop.
- **D-02:** Import results shown as summary toast ("Added 47, skipped 3 duplicates, 2 invalid") plus inline error list for invalid rows.
- **D-03:** Progress indicator shown during processing (for large files).
- **D-04:** Export includes all entries regardless of search/filter state. Four columns: email, name, notes, dateAdded.
- **D-05:** Filename format: `prical-allowlist-YYYY-MM-DD.csv`
- **D-06:** Import button visible to all users. Free users clicking it see an upgrade prompt ("CSV import is a Pro feature — Upgrade to Pro"). Shows value of upgrading.
- **D-07:** Export available to all users — no tier restriction. It's their data.

### Claude's Discretion
- CSV parsing library choice (papaparse or native)
- Batch size for API calls (GitHub issue suggests 50 at a time)
- Client-side vs server-side parsing approach
- Progress indicator component (progress bar vs spinner with count)
- Error report format (which columns shown for invalid rows)
- Whether import creates a new API route or uses existing allowlist endpoint

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | CSV import for allowlist (Pro+ gated) with email validation, duplicate skipping, progress indicator, and batch processing | Existing POST endpoint handles validation+dedup; papaparse parses client-side; batch 50 rows/call; TIER_LIMITS.csvImport gate already defined |
| LIST-02 | CSV export for allowlist with email, name, notes, and date columns | New GET export route returns text/csv; client-side download anchor trigger; no library needed |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | 5.5.3 | Client-side CSV parsing | De facto standard; handles BOM, quotes, line endings, streaming; zero dependencies |
| @types/papaparse | 5.5.2 | TypeScript types for papaparse | Official types package; matches library version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | already installed (^0.468.0) | Upload / Download icons for buttons | Already in project; use `Upload`, `Download` icons |
| @radix-ui/react-dialog | already installed (^1.0.5) | Upgrade prompt dialog for Free tier | Already in project via `src/components/ui/dialog.tsx` |

### No Additional Libraries Needed
| Problem | Solution | Reason |
|---------|----------|--------|
| CSV generation (export) | Native string construction | 4 columns, simple escaping — no library needed |
| File download | Anchor element + Blob URL | Standard browser API, no library needed |
| Progress tracking | React state counter | Batch calls increment a counter — no library needed |

**Installation (only new dependency):**
```bash
npm install papaparse @types/papaparse
```

**Version verification:**
- `papaparse`: npm registry shows 5.5.3 (verified 2026-03-21)
- `@types/papaparse`: npm registry shows 5.5.2 (verified 2026-03-21)

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/dashboard/
│   ├── csv-import-button.tsx     # Import button + file picker + processing logic
│   └── csv-export-button.tsx     # Export button + download trigger
├── app/api/allowlists/[id]/
│   ├── entries/route.ts          # EXISTING — reused for batch POST
│   └── export/route.ts           # NEW — GET returns text/csv
```

### Pattern 1: Client-Side CSV Parsing with papaparse
**What:** Read File object from `<input type="file">`, parse in browser, process rows client-side before batching to API.
**When to use:** All import operations. Avoids multipart upload complexity, provides immediate client-side validation before any API calls.
**Example:**
```typescript
// Source: papaparse official API (papaparse.org/docs)
import Papa from 'papaparse'

function parseCSVFile(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,         // First row becomes object keys
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    })
  })
}
```

### Pattern 2: Native File Input Trigger
**What:** A hidden `<input type="file" accept=".csv">` triggered programmatically by a Button's onClick. No drag-and-drop.
**When to use:** Per D-01 decision.
**Example:**
```typescript
// Standard React pattern — no library needed
const fileInputRef = useRef<HTMLInputElement>(null)

function handleImportClick() {
  // Tier check first
  if (!tierLimits.csvImport) {
    setShowUpgradeDialog(true)
    return
  }
  fileInputRef.current?.click()
}

// In JSX:
// <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
// <Button onClick={handleImportClick}><Upload className="mr-2 h-4 w-4" />Import CSV</Button>
```

### Pattern 3: Batch API Calls with Progress Tracking
**What:** Chunk parsed rows into groups of 50, call existing POST endpoint per chunk, update a counter for progress display.
**When to use:** All CSV imports. Keeps individual requests fast; 500 rows = 10 calls.
**Example:**
```typescript
// Discretion: batch size 50 recommended
const BATCH_SIZE = 50

async function processBatches(rows: ParsedRow[], allowlistId: string) {
  const batches = chunk(rows, BATCH_SIZE)
  let added = 0, duplicates = 0, invalid: InvalidRow[] = []

  for (let i = 0; i < batches.length; i++) {
    setProgress({ current: i * BATCH_SIZE, total: rows.length })
    const batch = batches[i]
    const response = await fetch(`/api/allowlists/${allowlistId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: batch.map(r => r.email) }),
    })
    const data = await response.json()
    added += data.added
    duplicates += data.duplicates?.length ?? 0
    // collect invalid rows with their original row numbers
  }

  setProgress({ current: rows.length, total: rows.length })
  return { added, duplicates, invalid }
}
```

### Pattern 4: CSV Export Route
**What:** New GET route at `/api/allowlists/[id]/export` fetches all entries (no pagination), constructs CSV string, returns with `Content-Type: text/csv` and `Content-Disposition: attachment`.
**When to use:** Export button click — the client receives the blob and triggers download.
**Example:**
```typescript
// New: src/app/api/allowlists/[id]/export/route.ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const allowlist = await prisma.allowlist.findFirst({ where: { id, userId: user.id } })
  if (!allowlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entries = await prisma.allowlistEntry.findMany({
    where: { allowlistId: id },
    orderBy: { createdAt: 'desc' },
  })

  const header = 'email,name,notes,dateAdded\n'
  const rows = entries.map(e =>
    [e.email, e.name ?? '', e.notes ?? '', e.createdAt.toISOString().slice(0, 10)]
      .map(field => `"${field.replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n')

  return new NextResponse(header + rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="prical-allowlist-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
```

### Pattern 5: Client-Side CSV Download Trigger
**What:** Fetch the export route, get blob, create object URL, click a synthetic anchor.
**When to use:** Export button onClick — triggers browser "Save As" without page navigation.
**Example:**
```typescript
async function handleExport(allowlistId: string) {
  setExporting(true)
  try {
    const response = await fetch(`/api/allowlists/${allowlistId}/export`)
    if (!response.ok) throw new Error('Export failed')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prical-allowlist-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    setExporting(false)
  }
}
```

### Pattern 6: Tier-Gate Upgrade Prompt
**What:** Check `TIER_LIMITS[subscriptionTier].csvImport` before opening file picker. If false, open Dialog with upgrade message.
**When to use:** Free users clicking Import CSV (D-06).
**Source pattern:** Existing `subscription-card.tsx` renders upgrade options. The upgrade Dialog for this phase should be simpler: a message + link to `/dashboard/settings` (or direct to billing).
**Example:**
```typescript
// TIER_LIMITS.FREE.csvImport === false (already in utils.ts)
// TIER_LIMITS.PRO.csvImport === true
// Pattern mirrors existing subscription-card upgrade flow
```

### Anti-Patterns to Avoid
- **Sending the raw File to the server:** Adds multipart upload complexity. Parse client-side with papaparse instead.
- **Sequential per-email API calls:** 500 individual fetch() calls would timeout. Batch 50 at a time.
- **Using the existing POST endpoint with name/notes:** The existing endpoint takes one `name` and one `notes` for the whole batch. CSV import emails have no per-row name/notes — pass only `emails` array.
- **Server-side CSV generation with a library:** For 4 columns, native string construction is sufficient. Libraries add install cost with no benefit here.
- **Omitting CSV escaping in export:** Fields may contain commas or quotes. Must wrap fields in double-quotes and escape inner quotes as `""`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom split/regex | papaparse | Edge cases: quoted commas, multiline fields, BOM, Windows CRLF, empty lines |
| Email validation | Custom regex | Already exists: `isValidEmail()` in `src/lib/utils.ts` | Already validated server-side in POST endpoint |
| Duplicate checking | Client-side set comparison | Existing POST endpoint returns `duplicates[]` | Server is authoritative; race conditions if done only client-side |
| Tier limit enforcement | Client-only check | Server-side: existing POST returns 403 when limit exceeded | Client check improves UX; server check is the real gate |

**Key insight:** The existing POST endpoint is already a mini-bulk-import endpoint — it accepts `emails[]`, validates, deduplicates, and enforces tier limits. The import feature is primarily a UI and orchestration layer on top of that.

---

## Common Pitfalls

### Pitfall 1: CSV Header Column Name Mismatch
**What goes wrong:** User's CSV has header `Email` (capitalized) or `email_address`. papaparse maps headers as-is, so `row.email` is undefined.
**Why it happens:** CSV exports from other tools use varied column names.
**How to avoid:** After parsing, do case-insensitive header matching: look for a column where `key.toLowerCase().includes('email')`. If no email column found, show a user-facing error: "CSV must have an 'email' column."
**Warning signs:** `added: 0, invalid: N` for a file that looks valid.

### Pitfall 2: Tier Limit Hit Mid-Import
**What goes wrong:** User has 490/500 entries, imports 50-row CSV. First batch adds 10, second batch returns 403. Import stops mid-way with unclear UX.
**Why it happens:** Existing POST endpoint returns 403 when `currentCount + batchSize > limit`.
**How to avoid:** Before starting the import loop, fetch current entry count and compute how many rows can be added. Warn the user if the CSV exceeds remaining capacity. Still proceed — the server will reject overflow rows, and the summary toast can report "Added X, limit reached."
**Warning signs:** 403 response from POST during import loop.

### Pitfall 3: File Input Not Resetting Between Imports
**What goes wrong:** User imports file A, then tries to import file A again. The `onChange` event doesn't fire because the value hasn't changed.
**Why it happens:** Native file input `onChange` only fires when value changes.
**How to avoid:** After processing completes, reset the file input: `fileInputRef.current.value = ''`.
**Warning signs:** Second import of same filename does nothing.

### Pitfall 4: papaparse Returns Empty Rows for Trailing Newline
**What goes wrong:** A CSV with a trailing newline produces one empty row at the end, causing `invalid` count to include a phantom entry.
**Why it happens:** Default papaparse behavior on trailing newline.
**How to avoid:** Use `skipEmptyLines: true` in papaparse config (shown in Pattern 1 above).
**Warning signs:** Invalid count is 1 higher than expected for all files.

### Pitfall 5: CSV Export Field Quoting
**What goes wrong:** A notes field containing a comma (e.g., "Sales, West") splits into two columns in Excel.
**Why it happens:** CSV requires quoting fields that contain commas, quotes, or newlines.
**How to avoid:** Always wrap all fields in double-quotes and escape inner quotes as `""` in the export route (shown in Pattern 4 above).
**Warning signs:** Columns shift in Excel for entries with commas in name/notes.

### Pitfall 6: `name` Field Conflict in POST Endpoint
**What goes wrong:** The existing POST endpoint's schema is `{ emails[], name?, notes?, expiresAt? }` — it applies one name/notes to all emails in the batch. A CSV with per-row name columns is not supported by this signature.
**Why it happens:** The existing endpoint was designed for adding a group of emails at once (e.g., a team).
**How to avoid:** For import phase, only send the `emails` array — no name/notes per CSV row. The requirement (LIST-01) only mentions email validation; name/notes import is not required. Document this as a known limitation.
**Warning signs:** If attempting per-row name/notes, would need to either call the API once per row (too slow) or add a new batch endpoint.

---

## Code Examples

### Papaparse Config for Import
```typescript
// Source: papaparse.org/docs — header:true returns array of objects keyed by header row
Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    // results.data: Array<Record<string, string>>
    // results.errors: Array<{type, code, message, row}>
    const emailColumn = Object.keys(results.data[0] ?? {})
      .find(k => k.toLowerCase() === 'email' || k.toLowerCase() === 'email_address')
    if (!emailColumn) {
      // show error: no email column found
      return
    }
    const emails = results.data.map(row => row[emailColumn]?.trim()).filter(Boolean)
  },
})
```

### Progress State Shape
```typescript
// Discretion: progress bar is clearer than spinner+count for bulk operations
interface ImportProgress {
  phase: 'idle' | 'parsing' | 'uploading' | 'done'
  current: number   // rows processed
  total: number     // total rows
}
// Display: "Adding emails... 150 / 500"
// Percent: Math.round((current / total) * 100)
```

### Upgrade Dialog Pattern
```typescript
// Mirrors existing Dialog usage in add-email-dialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// When Free user clicks Import:
<Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>CSV Import is a Pro Feature</DialogTitle>
      <DialogDescription>
        Upgrade to Pro to import emails in bulk from a CSV file.
      </DialogDescription>
    </DialogHeader>
    <div className="flex justify-end gap-2 pt-4">
      <Button variant="outline" onClick={() => setShowUpgradePrompt(false)}>Cancel</Button>
      <Button asChild>
        <a href="/dashboard/settings">Upgrade to Pro</a>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### Chunk Utility (no library needed)
```typescript
// Simple array chunker — no lodash required
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multipart file upload to server for parsing | Client-side parsing with papaparse | ~2018 | Eliminates server parsing complexity; faster feedback |
| Manual CSV string split | papaparse with `header: true` | ~2015 | Handles all edge cases including quotes, newlines, BOM |
| `window.open()` for downloads | Blob URL + synthetic anchor click | ~2016 | Works without popup blockers; allows custom filenames |

**Deprecated/outdated:**
- `FileReader.readAsText()` + manual CSV parsing: Still works but papaparse does this better with header mapping and edge case handling.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/app/api/allowlists` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIST-01 | Export route returns text/csv with correct headers and all entries | unit | `npx vitest run src/app/api/allowlists/[id]/export/export.test.ts` | Wave 0 |
| LIST-01 | Export route returns 401 for unauthenticated, 404 for wrong user | unit | `npx vitest run src/app/api/allowlists/[id]/export/export.test.ts` | Wave 0 |
| LIST-01 | Import: Free user tier check returns csvImport=false | unit | `npx vitest run src/lib/utils.test.ts` | Wave 0 |
| LIST-02 | CSV fields with commas/quotes are properly escaped in export | unit | `npx vitest run src/app/api/allowlists/[id]/export/export.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/app/api/allowlists`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/api/allowlists/[id]/export/export.test.ts` — covers LIST-01, LIST-02 export route behavior
- [ ] `src/lib/utils.test.ts` — covers TIER_LIMITS.csvImport values for each tier (may already exist — check before creating)

---

## Open Questions

1. **Per-row name/notes in CSV import**
   - What we know: The existing POST endpoint applies one name/notes to all emails in a batch. CSV files from other tools may include name columns.
   - What's unclear: Should the import support per-row name/notes columns?
   - Recommendation: Out of scope for this phase per requirements (LIST-01 only mentions email validation). Import emails only — name/notes are not required. Document as known limitation.

2. **Tier limit hit mid-import UX**
   - What we know: The POST endpoint returns 403 when the entry count would exceed the tier limit.
   - What's unclear: Should the import pre-check and warn, or just report at the end?
   - Recommendation: Pre-check at import start (compare CSV row count against remaining capacity) and show a warning toast if it will hit the limit. Still proceed — report actual results in summary.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/app/api/allowlists/[id]/entries/route.ts` — confirmed POST endpoint signature, response shape, dedup/validation behavior
- Codebase: `src/lib/utils.ts` — confirmed TIER_LIMITS.csvImport already defined for all tiers
- Codebase: `src/components/dashboard/add-email-dialog.tsx` — confirmed Dialog+toast pattern
- npm registry: `papaparse@5.5.3` — verified current version 2026-03-21
- npm registry: `@types/papaparse@5.5.2` — verified current version 2026-03-21

### Secondary (MEDIUM confidence)
- papaparse.org/docs — `header: true`, `skipEmptyLines: true` API options; consistent with library source and community usage
- MDN Web Docs — Blob URL + anchor click pattern for file download

### Tertiary (LOW confidence)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — papaparse version verified via npm registry; all other dependencies already in project
- Architecture: HIGH — patterns derived directly from existing codebase code, not from external sources
- Pitfalls: HIGH — derived from reading actual code paths (POST endpoint behavior, file input mechanics, CSV spec requirements)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (papaparse is stable; API unchanged for years)

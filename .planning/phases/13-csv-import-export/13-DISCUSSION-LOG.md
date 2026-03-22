# Phase 13: CSV Import & Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-22
**Phase:** 13-csv-import-export
**Areas discussed:** Import UX and feedback, Export format and scope, Tier gating behavior

---

## Import UX

| Option | Description | Selected |
|--------|-------------|----------|
| Button + file picker | 'Import CSV' opens native file dialog | ✓ |
| Drag-and-drop zone | Drop area on page | |
| Both | Button + drag-drop | |

| Option | Description | Selected |
|--------|-------------|----------|
| Summary toast + inline report | Toast with counts, inline error list | ✓ |
| Modal with detailed report | Full modal per-row status | |
| Toast only | Just counts | |

---

## Export Format

| Option | Description | Selected |
|--------|-------------|----------|
| All entries, 4 columns | email, name, notes, dateAdded — everything | ✓ |
| Only filtered entries | Export matching search results | |

| Option | Description | Selected |
|--------|-------------|----------|
| prical-allowlist-YYYY-MM-DD.csv | Dated filename | ✓ |
| allowlist-export.csv | Simple, no date | |

---

## Tier Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Visible but gated | Button visible, Free users see upgrade prompt | ✓ |
| Hidden for Free | Button only for Pro+ | |
| Disabled with tooltip | Grayed out | |

| Option | Description | Selected |
|--------|-------------|----------|
| Export for everyone | All users can export their data | ✓ |
| Pro+ only | Gate both import and export | |

## Claude's Discretion

CSV parsing library, batch size, client vs server parsing, progress indicator, error format, API route structure.

## Deferred Ideas

None.

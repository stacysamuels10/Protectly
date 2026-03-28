---
phase: 17
slug: domain-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.16 + @testing-library/react ^16.3.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx src/components/dashboard/domain-allowlist-section.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx src/components/dashboard/domain-allowlist-section.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | DOM-01 | unit | `npx vitest run src/components/dashboard/add-domain-dialog.test.tsx` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | DOM-01 | unit | same | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | DOM-02, DOM-03 | unit | `npx vitest run src/components/dashboard/domain-allowlist-section.test.tsx` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | DOM-03 | unit | same | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/dashboard/add-domain-dialog.test.tsx` — stubs for DOM-01 (add domain, scope warning, error handling)
- [ ] `src/components/dashboard/domain-allowlist-section.test.tsx` — stubs for DOM-02 (delete), DOM-03 (type badge)

*Test infrastructure exists — vitest, @testing-library/react, setup.ts with router mock and ResizeObserver mock are all in place. Only the two new test files are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual distinction between domain and email entries | DOM-03 | Visual appearance requires human eye | Open allowlist page, verify domain entries have visible badge/indicator distinct from email entries |
| Scope warning callout is noticeable | DOM-01 | UX judgment call | Open AddDomainDialog, verify warning text is visible and clearly communicates scope |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

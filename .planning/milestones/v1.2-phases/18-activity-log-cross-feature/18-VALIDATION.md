---
phase: 18
slug: activity-log-cross-feature
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 + @testing-library/react 16.3.1 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/dashboard/activity-log-client.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | ACTV-01 | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | ACTV-03 | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | ACTV-02 | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | ACTV-04 | unit | `npx vitest run src/components/dashboard/activity-log-client.test.tsx` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | ACTV-04 | unit | `npx vitest run src/app/api/dashboard/activity/` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | XFEAT-01 | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 2 | XFEAT-02 | unit | `npx vitest run src/components/dashboard/add-to-allowlist-button.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/dashboard/activity-log-client.test.tsx` — stubs for ACTV-01, ACTV-02, ACTV-03, ACTV-04
- [ ] `src/components/dashboard/add-to-allowlist-button.test.tsx` — stubs for XFEAT-01, XFEAT-02

*Existing infrastructure covers framework setup — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL persists filter state on page refresh | ACTV-01 | Requires real browser navigation | Navigate to activity page, click Rejected tab, verify URL shows ?status=REJECTED, refresh page, verify filter persists |
| Debounce search doesn't fire on every keystroke | ACTV-04 | Timing behavior hard to test in unit | Type quickly in search input, verify only one network request after 300ms pause |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

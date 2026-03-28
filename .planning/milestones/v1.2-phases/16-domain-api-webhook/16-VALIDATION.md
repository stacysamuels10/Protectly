---
phase: 16
slug: domain-api-webhook
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/app/api/allowlists` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/app/api/allowlists/\[id\]/domains`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | DOM-04 | unit | `npx vitest run src/app/api/allowlists/\[id\]/domains` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-01-05 | 01 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | DOM-04 | unit | `npx vitest run src/app/api/webhooks` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |
| 16-02-04 | 02 | 1 | DOM-04 | unit | same | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/allowlists/[id]/domains/domains.test.ts` — stubs for domain POST and DELETE routes (DOM-04 API surface)
- [ ] `src/app/api/webhooks/calendly/webhook-domain.test.ts` — stubs for domain hash matching in webhook handler (DOM-04 webhook surface)

*Pattern reference: `src/app/api/allowlists/allowlists.test.ts` shows exact mock structure (vi.mock for prisma, session, utils) that domain tests should replicate.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

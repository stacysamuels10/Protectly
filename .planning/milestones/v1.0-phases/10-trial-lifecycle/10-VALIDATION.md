---
phase: 10
slug: trial-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.4 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TRIAL-01, TRIAL-02 | unit | `npx vitest run src/app/api/cron/trial-expiry/route.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | TRIAL-01 | config | `grep -q 'trial-expiry' vercel.json` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/cron/trial-expiry/route.test.ts` — stubs for TRIAL-01/TRIAL-02 (cron handler, idempotency, auth guard)

*Existing vitest infrastructure covers test runner needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel Cron fires at 9am UTC | TRIAL-01 | Requires deployed Vercel instance with cron config | Deploy, wait for cron trigger, check Vercel function logs |
| Warning emails delivered to inbox | TRIAL-02 | Requires Resend API key and verified domain | Trigger cron with test users, check email delivery |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 8
slug: email-infrastructure-preferences
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

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
| 08-01-01 | 01 | 1 | EMAIL-01 | unit | `npx vitest run src/lib/email.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | EMAIL-01 | grep | `ls src/emails/*.tsx \| wc -l` | ✅ | ⬜ pending |
| 08-02-01 | 02 | 2 | EMAIL-04 | unit | `npx vitest run src/app/api/settings/email-preferences` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | EMAIL-04 | grep | `grep -q 'EmailPreferencesForm' src/app/(dashboard)/dashboard/settings/page.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/email.test.ts` — stubs for EMAIL-01 (Resend singleton, sendEmail function)
- [ ] `src/app/api/settings/email-preferences/route.test.ts` — stubs for EMAIL-04 (GET/PATCH handlers)

*Existing vitest infrastructure covers test runner needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resend delivers email to inbox | EMAIL-01 | Requires Resend API key and verified domain | Call sendEmail() with test template, check inbox |
| Email templates render in real clients | EMAIL-01 | Requires visual inspection across email clients | Send test email, open in Gmail/Outlook/Apple Mail |
| Domain DNS verification completes | EMAIL-01 | External DNS propagation | Check Resend dashboard for verified status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

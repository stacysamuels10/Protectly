---
phase: 7
slug: observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 — Validation Strategy

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
| 07-01-01 | 01 | 1 | OBS-03 | unit | `npx vitest run src/lib/logger.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | OBS-03 | grep | `grep -r 'console\.\(log\|error\|warn\)' src/ --include='*.ts' --include='*.tsx' \| grep -v test \| wc -l` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | OBS-01 | config | `test -f instrumentation.ts && echo OK` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | OBS-01 | grep | `grep -q 'beforeSend' sentry.client.config.ts && echo OK` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | OBS-02 | unit | `npx vitest run src/lib/posthog-server.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 1 | OBS-02 | grep | `grep -q 'PHProvider' src/app/layout.tsx && echo OK` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/logger.test.ts` — stubs for OBS-03 (logger singleton, log level, JSON format)
- [ ] `src/lib/posthog-server.test.ts` — stubs for OBS-02 (singleton, shutdown, identify)
- [ ] Sentry config files created by wizard — no pre-stub needed

*Existing vitest infrastructure covers test runner needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sentry captures error with readable stack trace | OBS-01 | Requires deployed app + Sentry dashboard | Deploy preview, throw test error, verify in Sentry UI within 60s |
| PostHog receives booking_processed event | OBS-02 | Requires deployed app + PostHog dashboard | Process test webhook, check PostHog Live Events |
| Sentry PII scrubbing active | OBS-01 | Requires real Sentry event inspection | Trigger error in webhook handler, verify no email/name in Sentry event |
| Source maps resolve to TypeScript | OBS-01 | Requires Vercel build + Sentry | Deploy, trigger error, verify stack trace shows .ts files |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

# Phase 10: Trial Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 10-trial-lifecycle
**Areas discussed:** Cron timing and frequency, Downgrade behavior

---

## Cron Timing and Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| 9am UTC | Mid-morning for US/EU. Warning emails arrive during business hours. | ✓ |
| Midnight UTC | Process at day boundary. Emails arrive overnight. | |
| You decide | Claude picks | |

**User's choice:** 9am UTC
**Notes:** None

---

## Downgrade Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep but enforce limits | Allowlists stay. FREE tier limits enforced at runtime. | ✓ |
| Delete excess entries | Trim to FREE limit. Destructive. | |
| Keep everything as-is | No data changes, just tier change. | |

**User's choice:** Keep but enforce limits
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with FREE limits | Protection stays active but limited. Core value works. | ✓ |
| Disable protection entirely | No cancellations on FREE. | |

**User's choice:** Yes, with FREE limits
**Notes:** None

---

## Claude's Discretion

- Prisma queries for finding users at each stage
- Idempotency mechanism
- Email batching approach
- Logging detail level
- Partial failure handling

## Deferred Ideas

None — discussion stayed within phase scope.

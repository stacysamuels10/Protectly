# Phase 8: Email Infrastructure & Preferences - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 08-email-infrastructure-preferences
**Areas discussed:** Email template design, Email preferences UX, Sender identity

---

## Email Template Design

| Option | Description | Selected |
|--------|-------------|----------|
| Clean minimal | White background, single-column, no heavy branding. Like Stripe/Linear. | ✓ |
| Branded with color | Brand colors, logo header, styled footer. | |
| Plain text style | HTML but looks like plain text. | |

**User's choice:** Clean minimal
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Professional and direct | Formal, business-like copy | |
| Friendly and casual | Cutesy, informal copy | |
| You decide | Claude picks | |

**User's choice:** Other — "those two are a bit extreme. i want something in between"
**Notes:** Warm and professional. Not stiff, not overly casual. Helpful and clear.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show why | Specific rejection reason (not on allowlist, unapproved guest, etc.) | ✓ |
| Generic message only | Just say cancelled without reason | |

**User's choice:** Yes, show why
**Notes:** None

---

## Email Preferences UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-type toggles | Three separate toggles: Approved, Rejected, Trial warnings. All default ON. | ✓ |
| Single master toggle | One ON/OFF switch | |
| Two toggles | Booking notifications + Trial warnings | |

**User's choice:** Per-type toggles
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| After Guest Checking | Groups near protection settings | ✓ |
| After Subscription | Near top, after billing | |
| You decide | Claude picks | |

**User's choice:** After Guest Checking
**Notes:** None

---

## Sender Identity

| Option | Description | Selected |
|--------|-------------|----------|
| PriCal | Short, matches app title | |
| Protectly | Project name, formal | |
| PriCal Notifications | Distinguishes from marketing | ✓ |

**User's choice:** PriCal Notifications
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| notifications@prical.io | Standard transactional | ✓ |
| hello@prical.io | Friendlier | |
| You decide | Claude picks | |

**User's choice:** notifications@prical.io
**Notes:** None

---

## Claude's Discretion

- React Email component structure and shared layout
- Exact email subject lines
- Toggle component implementation
- Reply-to configuration
- Email preview text
- Prisma column naming

## Deferred Ideas

None — discussion stayed within phase scope.

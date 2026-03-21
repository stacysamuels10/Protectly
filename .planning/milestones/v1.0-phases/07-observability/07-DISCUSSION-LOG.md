# Phase 7: Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 07-observability
**Areas discussed:** PII scrubbing rules, Log verbosity in production, PostHog event taxonomy

---

## PII Scrubbing Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Strip all user data | Remove emails, names, tokens, IPs. Keep only error type, stack trace, request path. Safest for compliance. | ✓ |
| Keep anonymized identifiers | Strip emails/names but keep hashed user IDs and request paths. | |
| Minimal scrubbing | Only strip tokens/secrets. Keep emails and names. | |

**User's choice:** Strip all user data
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| All routes including webhooks | Webhook failures are critical — missed cancellations mean unauthorized bookings. | ✓ |
| User-facing routes only | Webhook errors logged via pino but not sent to Sentry. | |

**User's choice:** All routes including webhooks
**Notes:** None

---

## Log Verbosity in Production

| Option | Description | Selected |
|--------|-------------|----------|
| info | Log all operations: webhook received, booking approved/rejected, token refresh, auth events. | ✓ |
| warn | Only log warnings and errors. Quieter. | |

**User's choice:** info
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Log event type + IDs only | Log event_type, invitee URI, event URI — enough to trace without PII. | ✓ |
| Log full payload at debug level | Full webhook body at debug level (off in prod by default). | |
| No payload data | Only log that a webhook was received. | |

**User's choice:** Log event type + IDs only
**Notes:** None

---

## PostHog Event Taxonomy

Events selected (multi-select):

| Option | Description | Selected |
|--------|-------------|----------|
| Core 4 from GitHub issue | signup, add_email, upgrade_click, webhook_received | ✓ |
| Booking outcomes | booking_approved, booking_rejected | ✓ |
| Allowlist actions | allowlist_add, allowlist_remove, allowlist_import | |
| Auth events | login, logout, token_refresh_failed | ✓ |

**User's choice:** Core 4 + Booking outcomes + Auth events (not allowlist actions)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| snake_case | booking_approved, allowlist_add — PostHog convention | ✓ |
| Verb-first | user_signed_up, email_added — more descriptive but verbose | |

**User's choice:** snake_case
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Database user ID | Prisma auto-generated ID — stable, no PII leak | ✓ |
| Calendly user URI | Correlates with Calendly but exposes external ID | |

**User's choice:** Database user ID
**Notes:** None

---

## Claude's Discretion

- Sentry alert notification rules and thresholds
- Pino transport configuration and log formatting
- PostHog proxy rewrite path
- global-error.tsx design
- Exact pino log field names beyond required set

## Deferred Ideas

None — discussion stayed within phase scope.

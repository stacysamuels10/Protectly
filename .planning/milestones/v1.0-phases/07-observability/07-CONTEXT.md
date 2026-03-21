# Phase 7: Observability - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add production error monitoring (Sentry), replace all console.log/error with structured JSON logging (pino), and track key product events in PostHog. Pure infrastructure — no UI changes, no user-facing behavior changes.

</domain>

<decisions>
## Implementation Decisions

### PII Scrubbing (Sentry)
- **D-01:** Strip ALL user data from Sentry events — no emails, names, tokens, or IPs. Keep only error type, stack trace, and request path.
- **D-02:** Capture errors from ALL routes including webhook handlers (Calendly and Stripe). Webhook failures are critical — missed cancellations mean unauthorized bookings get through.

### Log Verbosity
- **D-03:** Production log level defaults to `info` — log all operations (webhook received, booking outcomes, token refresh, auth events).
- **D-04:** Webhook payloads logged as event type + IDs only (event_type, invitee URI, event URI). No full payload data, no PII in logs.

### PostHog Event Taxonomy
- **D-05:** Events tracked in this phase (snake_case naming convention):
  - `signup` — user completes Calendly OAuth
  - `add_email` — user adds email to allowlist
  - `upgrade_click` — user clicks upgrade/checkout
  - `webhook_received` — webhook endpoint hit
  - `booking_approved` — booking passes allowlist check
  - `booking_rejected` — booking fails allowlist check and is cancelled
  - `login` — user authenticates
  - `logout` — user logs out
  - `token_refresh_failed` — Calendly token refresh fails
- **D-06:** User identification via database user ID (Prisma auto-generated). No Calendly URI or email sent to PostHog.

### Claude's Discretion
- Sentry alert notification rules and thresholds
- Pino transport configuration and log formatting
- PostHog proxy rewrite path (`/ingest` or similar)
- Loading skeleton or error boundary design for global-error.tsx
- Exact pino log field names beyond the required (requestId, userId, action)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Observability research
- `.planning/research/STACK.md` — Package versions, integration patterns, what NOT to use
- `.planning/research/ARCHITECTURE.md` — Integration architecture, component map, build order
- `.planning/research/PITFALLS.md` — Critical pitfalls (PostHog serverless flush, pino Edge Runtime, Sentry onRequestError)

### Project context
- `.planning/research/SUMMARY.md` — Synthesized research findings and phase ordering rationale

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/env.ts` — Zod env validation; new env vars (SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, etc.) should be added here
- `src/app/layout.tsx` — Root layout with QueryProvider; PostHog PHProvider wraps here
- `src/components/providers/query-provider.tsx` — Existing provider pattern to follow for PostHog provider

### Established Patterns
- All lib modules use `@/` path alias imports
- `src/lib/*.ts` for utility singletons (session.ts, stripe.ts, calendly.ts, encryption.ts)
- Test files colocated as `*.test.ts` next to source
- `next.config.js` (not `.ts`) — needs `serverExternalPackages` for pino and `withSentryConfig` wrapper

### Integration Points
- 43 console.log/error calls across 6 files to replace:
  - `src/app/api/webhooks/calendly/route.ts` (25 calls — bulk of logging)
  - `src/app/api/auth/calendly/callback/route.ts` (9 calls)
  - `src/app/api/webhooks/stripe/route.ts` (3 calls)
  - `src/lib/calendly.ts` (4 calls)
  - `src/app/api/billing/checkout/route.ts` (1 call)
  - `src/app/api/billing/portal/route.ts` (1 call)
- PostHog server-side events fire from webhook handlers and auth callback
- Sentry instrumentation files at project root: `instrumentation.ts`, `instrumentation-client.ts`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all three tools (Sentry, pino, PostHog). Research recommendations should guide implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-observability*
*Context gathered: 2026-03-21*

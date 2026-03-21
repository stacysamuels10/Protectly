# Pitfalls Research

**Domain:** Production infrastructure retrofit — Sentry, PostHog, structured logging, transactional email, Vercel Cron, email preferences on Next.js 15 App Router SaaS (Protectly)
**Researched:** 2026-03-21
**Confidence:** HIGH (official docs + GitHub issues verified; training data corroborated by current sources)

---

## Critical Pitfalls

### Pitfall 1: Sentry Does Not Capture Server Component Errors Without `onRequestError`

**What goes wrong:**
Errors thrown inside React Server Components are not automatically captured by Sentry in older SDK versions. Developers install `@sentry/nextjs`, add the `sentry.server.config.ts` file, deploy, and assume all server errors are tracked — but RSC errors are silently swallowed. The Sentry dashboard shows no errors even when server components are crashing.

**Why it happens:**
The `onRequestError` hook that enables RSC error capture requires `@sentry/nextjs` >= 8.28.0 AND `next` >= 15. Most tutorials were written for Pages Router or older SDK versions and do not mention this requirement. Developers follow a guide that is subtly outdated.

**How to avoid:**
Pin `@sentry/nextjs` to >= 8.28.0 in `package.json`. Add the `onRequestError` hook explicitly in `instrumentation.ts` (the file Next.js 15 uses for SDK initialization). Verify by intentionally throwing in a Server Component in a preview deployment and confirming the error appears in Sentry within 30 seconds.

**Warning signs:**
- `@sentry/nextjs` version below 8.28.0.
- `instrumentation.ts` missing or not exporting `register()` and `onRequestError()`.
- Sentry shows zero server-side errors after a week of production traffic — Server Components never throw anything, even benign errors.

**Phase to address:** Sentry setup phase — version constraint and `onRequestError` wiring are day-one requirements, not optional enhancements.

---

### Pitfall 2: Sentry Source Maps Broken Because `SENTRY_AUTH_TOKEN` Is Not Set in Vercel

**What goes wrong:**
Sentry uploads source maps during the build so stack traces in the dashboard show readable TypeScript rather than minified JavaScript. If `SENTRY_AUTH_TOKEN` is not set as a Vercel environment variable, the upload silently fails (no build error). Every error in Sentry shows an unreadable minified stack trace. Debugging production errors becomes extremely difficult and this is not discovered until the first real incident.

**Why it happens:**
The token is set locally in `.env.local` and works in local builds. Developers forget to add it to Vercel's environment settings. The Sentry Webpack plugin does not fail the build on missing auth token by default — it logs a warning that is buried in build output.

**How to avoid:**
Set `SENTRY_AUTH_TOKEN` in Vercel environment variables (all environments: production, preview, development). Also set `SENTRY_ORG` and `SENTRY_PROJECT`. Add a CI check or build-time assertion that fails loudly if these are absent. Note: with Turbopack (Next.js 15 default), source maps upload *after* the build completes, requiring `@sentry/nextjs` >= 10.13.0 and Next.js >= 15.4.1. With Webpack, they upload *during* the build — behavior differs between bundlers.

**Warning signs:**
- Stack traces in Sentry show minified code (`a.b.c is not a function` with no file/line).
- `SENTRY_AUTH_TOKEN` not listed in Vercel project settings.
- Build logs show "Sentry: Auth token missing" warnings (even though the build succeeded).

**Phase to address:** Sentry setup phase — verify source maps are working in a preview deployment before shipping to production.

---

### Pitfall 3: Sentry Captures PII From Request Context and Webhook Payloads

**What goes wrong:**
Sentry's default error capture includes request context — headers, query parameters, and sometimes request bodies. Protectly's webhook handler receives Calendly payloads containing user email addresses, invitee names, and event details. If an error is thrown during webhook processing, Sentry captures the full request context including this PII. This creates a GDPR compliance exposure: personal data is sent to a third-party service (Sentry's US-hosted cloud) without explicit user consent for that purpose.

**Why it happens:**
Default Sentry behavior is maximally helpful for debugging — it captures everything available. The developer does not configure scrubbing because the default "works fine" for most apps. PII in webhook payloads is not obvious because the payload arrives as an opaque request body.

**How to avoid:**
Configure `beforeSend` in `sentry.server.config.ts` to strip sensitive fields from event data before transmission. At minimum: remove request body from webhook events, scrub any field named `email`, `name`, `invitee`, or containing token values. Use Sentry's `denyUrls` to prevent breadcrumbs from capturing webhook payloads. If using Session Replay on the client, enable `maskAllText: true` (already default, but verify it is not disabled). Keep breadcrumbs disabled for routes that process user PII.

**Warning signs:**
- No `beforeSend` callback in `sentry.server.config.ts`.
- Sentry events for webhook route errors show full request body in the "Request" tab.
- Email addresses visible in Sentry event breadcrumbs or context fields.

**Phase to address:** Sentry setup phase — data scrubbing must be configured before the first production deploy, not added retroactively after PII has already been transmitted.

---

### Pitfall 4: PostHog Provider Wrapping the Entire App Tree Forces Client Rendering

**What goes wrong:**
The standard PostHog setup involves wrapping the application in a `<PHProvider>` component that uses `'use client'`. Developers place this in the root `layout.tsx` directly wrapping `{children}`. This makes all child Server Components render as "holes" through a client boundary — they still render on the server but lose their ability to be statically generated. More importantly, every page becomes a client component from React's perspective, defeating the performance benefits of the App Router.

**Why it happens:**
PostHog's own documentation shows a simple `<PHProvider>` wrapper and many tutorials replicate this naively in the root layout. The consequence on server rendering is not obvious because pages still appear to work.

**How to avoid:**
Create a `PostHogProvider` wrapper component in its own file marked `'use client'`. Import it in `layout.tsx` and wrap only `{children}` — but do not place other server-side functionality inside it. PostHog's `posthog-js` package only loads on the client; server-side tracking uses `posthog-node` separately. Keep these two completely separate: `posthog-js` for browser events, `posthog-node` for server-side events from route handlers and Server Actions.

**Warning signs:**
- `'use client'` appearing in `app/layout.tsx` itself (not in a separate file).
- All pages showing as client-rendered in Next.js build output (`○` instead of `●` or `λ`).
- PostHog initialization code mixed into the same file as server-side logic.

**Phase to address:** PostHog setup phase — architecture decision (separate client/server SDKs) must be made before writing any tracking code.

---

### Pitfall 5: PostHog Server-Side Events Lost in Serverless Because `shutdown()` Is Never Called

**What goes wrong:**
The `posthog-node` SDK batches events and flushes them asynchronously. In a serverless environment (Vercel), the function process can be frozen or terminated after the response is sent, before the flush completes. Events tracked on the server — booking approved, booking rejected, trial expired — silently disappear. The dashboard shows events from the browser but nothing from server-side route handlers.

**Why it happens:**
`posthog-node` was designed for long-running servers where background flush intervals work naturally. Developers copy examples from Node.js server documentation that assume persistent processes. In Next.js route handlers, the process lifecycle ends with the response.

**How to avoid:**
In every Next.js API route or Server Action that calls `posthog.capture()`, immediately follow with `await posthog.shutdown()`. Alternatively use `await posthog.flush()` if the same instance is reused within the request. Set `flushAt: 1` and `flushInterval: 0` on the server-side PostHog instance to force immediate flush on every event. Create a shared `lib/posthog-server.ts` that always exports an instance configured for serverless (not the long-running-server defaults).

**Warning signs:**
- Server-side PostHog events appear in development but not production.
- `posthog-node` instance created with default `flushAt` and `flushInterval` settings.
- No `await posthog.shutdown()` or `await posthog.flush()` call visible after `capture()` in route handlers.
- Known issue: `await posthog.shutdown()` can hang in some edge runtime environments — test this in a preview deploy and add a timeout wrapper if needed.

**Phase to address:** PostHog setup phase — the serverless configuration must be the starting point for the server-side SDK instance, not an afterthought.

---

### Pitfall 6: Pino Logger Breaks in Edge Runtime and Gets Bundled Into the Client

**What goes wrong:**
Two distinct failures occur when Pino is added without runtime-aware configuration:

1. **Edge Runtime failure**: Pino uses Worker Threads for async logging. The Edge Runtime (used by Next.js Middleware and some Route Handlers configured with `export const runtime = 'edge'`) does not support Node.js Worker Threads. Pino's `transport()` method throws `TypeError: pino.transport is not a function` at runtime.

2. **Client bundle failure**: Next.js attempts to bundle Pino for client components because the import is not properly gated. Pino depends on `fs`, `worker_threads`, and `thread-stream`, which are Node.js-only. The client build fails or produces a broken bundle.

**Why it happens:**
Pino is a Node.js library with excellent performance characteristics for servers, but its internals assume a full Node.js environment. Next.js's isomorphic bundling tries to include server modules in the client bundle unless explicitly excluded. Developers add `import pino from 'pino'` to a shared utility file used by both server and client code.

**How to avoid:**
Keep the logger in server-only files — add `import 'server-only'` at the top of `lib/logger.ts`. Add Pino's dependencies to `serverExternalPackages` in `next.config.ts` so Next.js does not bundle them:
```ts
serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream']
```
Do not configure Pino transports in Next.js middleware routes. For Middleware (which runs on Edge), either avoid structured logging entirely or use a simple `console.log(JSON.stringify(...))` wrapper instead of Pino. For development pretty-printing, use `pino-pretty` as a dev dependency only, not a runtime dependency.

**Warning signs:**
- `TypeError: pino.transport is not a function` in Vercel function logs.
- Build errors mentioning `fs` or `thread-stream` in browser bundle.
- `pino-pretty` in production `dependencies` rather than `devDependencies`.
- Logger imported from a file that does not have `'server-only'` guard.

**Phase to address:** Structured logging phase — configure `serverExternalPackages` and add `'server-only'` guard before writing any logging code.

---

### Pitfall 7: Vercel Cron Job Runs Against Static Route Handler (No-Op in Production)

**What goes wrong:**
The Vercel Cron handler is a Next.js Route Handler at (for example) `/api/cron/expire-trials`. If this route is not explicitly forced to dynamic, Next.js 15's aggressive caching may statically generate it at build time — especially if it has no dynamic dependencies detected at build time. The cron job fires, hits a cached static response, and the trial expiry logic never actually runs. No error is thrown; the cron shows `200 OK` in Vercel's dashboard. Trials accumulate without being expired.

**Why it happens:**
Next.js 15 defaults to static generation for routes that appear cacheable. The trial expiry route reads from a database (dynamic), but if Next.js does not detect this during build analysis, it may generate a static version. Developers assume a non-`GET` handler or a database-connected route is always dynamic — this is not guaranteed.

**How to avoid:**
Add `export const dynamic = 'force-dynamic'` at the top of every cron route handler file. This is not optional. Also add `export const runtime = 'nodejs'` to ensure the route runs in the Node.js runtime (not Edge), which is required for Prisma database access. Verify the cron endpoint is listed in `vercel.json` under `"crons"` with the correct path and schedule.

**Warning signs:**
- Cron route missing `export const dynamic = 'force-dynamic'`.
- Vercel dashboard shows cron invocations returning `200 OK` but database records are unchanged.
- Build output shows the cron route compiled as a static page (`○`) rather than a serverless function (`λ`).

**Phase to address:** Trial expiry cron phase — add both `dynamic` and `runtime` exports before writing any business logic in the cron handler.

---

### Pitfall 8: Cron-Triggered Trial Expiry Sends Duplicate Emails on Retry

**What goes wrong:**
Vercel's cron system can deliver the same invocation more than once (at-least-once delivery, not exactly-once). If the trial expiry job sends emails and then crashes before marking trials as expired in the database, the next cron invocation sends the emails again. Users receive multiple "Your trial has expired" emails. Beyond being annoying, repeated emails for billing-related events damage sender reputation and user trust.

**Why it happens:**
Developers write the cron job as: (1) find expiring trials, (2) send email, (3) update database. If step 3 fails or the function times out, the next run repeats from step 1. The job is not idempotent.

**How to avoid:**
Flip the order: (1) find expiring trials, (2) update database status (mark as `EXPIRED` or set `trialExpiresAt` to processed), (3) send email. Use a Prisma transaction to atomically mark the record and capture the pre-update state in a single operation. Only send the email if the database update succeeded (i.e., the row was actually changed — use `updateMany` and check `count > 0`). This way, if the email send fails, the record is already marked and the next cron run will not find it again. For the email failure case, implement a separate retry mechanism (not cron-based) or accept the occasional missed email as preferable to duplicates.

**Warning signs:**
- Cron job sends email before updating the database record.
- No check that the trial was actually updated (optimistic `update` without checking affected rows).
- Trial status field is not updated atomically with the email trigger.

**Phase to address:** Trial expiry cron phase — design the write-first, email-second flow before implementing either step.

---

### Pitfall 9: `console.log` Replacement Breaks Existing Test Spies

**What goes wrong:**
The existing test suite likely has tests that assert on `console.error` or `console.log` output using `vi.spyOn(console, 'error')`. When the logger is switched from `console.log` to `logger.error()`, these spies stop firing, causing tests to pass incorrectly (the assertions no longer catch errors that the code is still emitting — just to a different target). Conversely, some tests may assert that `console.error` is *not* called; after migration those pass vacuously because nothing calls `console.error` anymore.

**Why it happens:**
`console.log` replacement is treated as a pure find-and-replace refactor. The impact on test assertions is not considered. This is compounded by the fact that logging is often in error handling paths that are difficult to trigger in unit tests.

**How to avoid:**
Before replacing any `console.log`, grep for all `console` spies in the test suite: `grep -r "spyOn(console" src/`. For each spy, determine whether it should be updated to spy on the logger instead, or whether the test should be rewritten to assert on observable side effects (status codes, database state) rather than log output. After migration, do a final pass confirming no `console.log` or `console.error` calls remain in production code (acceptable in scripts and tests).

**Warning signs:**
- Tests using `vi.spyOn(console, 'error')` exist alongside logger migration work.
- `console` spy assertions passing after logger migration without having been updated.
- `console.log` and `logger.info` both present in the same file after migration.

**Phase to address:** Structured logging phase — audit test spies before starting the replacement, not after.

---

### Pitfall 10: Resend Domain Not Verified Before First Email Send Attempt

**What goes wrong:**
Resend requires DNS verification of a sending domain before emails are delivered. Until the domain is verified, emails either fail silently or land in spam. The verification involves adding TXT, MX, and DKIM records to DNS. DNS propagation takes 24–48 hours. If domain verification is not started until the email feature is being tested, it blocks the entire testing phase.

Additionally, attempting to send from an unverified domain returns a 400 error from Resend's API. If the sending utility does not surface this error clearly (e.g., it catches and logs it without throwing), the failure is invisible — email sending "works" in code review but no emails arrive.

**Why it happens:**
Resend is positioned as a simple drop-in email library. Developers install it, write the sending code, and then discover that DNS verification is a multi-day prerequisite. This is not a code problem — it is an infrastructure dependency with a time dimension.

**How to avoid:**
Initiate Resend domain verification on day one of the email phase, before writing any code. Use Resend's sandbox/test mode (sending to your own verified email address) during development so code can be validated without a production domain. Ensure the sending utility propagates Resend API errors (do not silently catch them). Add an explicit startup check or a health endpoint that verifies the Resend API key is valid.

**Warning signs:**
- Resend domain verification not initiated before starting email code implementation.
- Sending utility has a broad `catch` that returns `{ success: false }` without logging the error detail.
- No test that asserts on Resend API call arguments (which would surface a 400 error).

**Phase to address:** Transactional email setup phase — domain verification is a prerequisite that must be started at phase kickoff, not as part of implementation.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single PostHog client instance shared across server requests | Less boilerplate | Memory leak risk in long-running processes; state leakage between requests in test environments | Only with careful instantiation-per-request pattern and explicit shutdown |
| Skipping `beforeSend` PII scrubbing in Sentry for "just the MVP" | Faster setup | PII transmitted to Sentry from day one; GDPR exposure accumulates retroactively | Never — scrubbing must be configured on first deploy |
| Putting email sending logic directly in API route handlers | Simple, fast to ship | Hard to test; can't retry failed sends; no separation of concerns | Only acceptable if a dedicated email service module is added before the second email type |
| Using `node-cron` or `setTimeout` for scheduled jobs in Vercel | No `vercel.json` changes needed | Runs once per cold start then disappears silently; creates the illusion the cron is working | Never on Vercel serverless |
| Logging full request/response objects with `logger.info(req)` | Maximum debug info | Logs contain PII, tokens, and cookie values; fills log storage quota rapidly | Never in production — always whitelist specific fields |
| Using `console.log` alongside the new structured logger "temporarily" | Easier migration | Partial migration is permanent in practice; mixed log formats break parsing pipelines | Never beyond a single sprint; migration must be completed atomically per file |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Sentry + Vercel | Setting `SENTRY_AUTH_TOKEN` only in local `.env.local` | Add to Vercel environment variables (production, preview, development) explicitly |
| Sentry + Next.js 15 Turbopack | Using `@sentry/nextjs` < 10.13.0 with Turbopack expecting source maps to work | Pin `@sentry/nextjs` >= 10.13.0 and Next.js >= 15.4.1; source maps upload *after* build with Turbopack (not during) |
| PostHog + Next.js App Router | Initializing `posthog-js` in a server component or shared utility | Use `posthog-js` in `'use client'` components only; use `posthog-node` separately for all server-side tracking |
| PostHog + Vercel serverless | Using default `flushAt: 20, flushInterval: 10000` from long-running server examples | Set `flushAt: 1, flushInterval: 0` and call `await posthog.shutdown()` on every serverless route |
| Resend + Railway/Vercel | Hardcoding `from: 'noreply@yourdomain.com'` before domain is verified | Use Resend's test mode with a verified personal email during development; switch domain only after DNS propagation confirmed |
| Vercel Cron + Prisma | Importing Prisma client in a cron route without `export const runtime = 'nodejs'` | Prisma requires Node.js runtime; always add `export const runtime = 'nodejs'` to cron route handlers |
| Pino + Next.js Middleware | Using Pino in middleware expecting it to log like in API routes | Middleware runs on Edge Runtime; use `console.log(JSON.stringify(...))` or skip structured logging in middleware entirely |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous email sending inside the webhook handler request/response cycle | Webhook handler latency exceeds 4 seconds; Calendly retries pile up | Send email in a background task using `waitUntil` (Vercel) or decouple via queue; never block the response on email send | At ~10 concurrent bookings being processed |
| Prisma `findMany` without date filter in cron job (scanning all users) | Trial expiry cron slows to minutes; database CPU spikes on schedule | Always filter: `WHERE trialEndsAt <= NOW() AND status = 'TRIAL'` with a database index on `(status, trialEndsAt)` | At ~1,000 users in the database |
| Structured logger writing to stdout synchronously on every webhook event | Webhook handler latency increases by 5–15ms per log line | Pino is async-safe by default but transports add overhead; avoid remote transports in the hot webhook path | At ~100 webhook events/minute |
| PostHog capturing raw webhook payloads as event properties | PostHog event payload size limit hit; events dropped silently | Capture only a whitelist of properties (event type, user ID, outcome) — never the full webhook payload | At ~50 properties per event |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cron endpoint not protected by secret header check | Any external party can trigger trial expiry by calling `/api/cron/expire-trials` | Verify `Authorization: Bearer <CRON_SECRET>` header on every cron route; set `CRON_SECRET` in Vercel env; Vercel automatically sends this header for cron invocations |
| Unsubscribe link using predictable user ID as the only parameter | Any user can construct a URL to unsubscribe another user | Use a signed token (HMAC of `userId + email + timestamp`) as the unsubscribe link parameter; validate signature server-side |
| Resend API key in client-side code | API key exposed in browser; attacker can send arbitrary emails from your domain | Resend SDK must only be called from server-side code (API routes, Server Actions); never import in client components |
| Sentry DSN in server config capturing auth tokens from headers | Session cookies or `Authorization` headers appear in Sentry breadcrumbs | Configure `denyUrls`, scrub `Authorization` header in `beforeSend`, and disable breadcrumb capture for authenticated routes |
| PostHog capturing the full allowlist contents as event properties | Allowlist email addresses (user PII) sent to PostHog cloud | Capture only counts (`allowlist_size: 42`), never the email addresses themselves |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sending trial expiry email and immediately downgrading in the same cron run | User has no warning before access is cut off | Separate the warning email (3 days before, 1 day before) from the actual downgrade; downgrade only on day 0 after all warnings have been sent |
| Email notification preferences defaulting to "all off" | Users miss important booking notifications; unclear why emails stopped | Default to "all on" with clear opt-out controls; only silence non-critical notifications for users who explicitly opt out |
| No confirmation after user saves email preferences | User is unsure if their change was saved | Show a persistent success toast after save; reflect the saved state in the UI immediately (optimistic update) |
| Trial expiry email lacking a direct "Upgrade now" link to Stripe checkout | Users have to navigate to the app and find the upgrade button themselves | Include a direct Stripe Checkout link or Stripe Customer Portal link in the email body |
| Email preferences UI buried in settings without any discovery path | Users who want to reduce email noise cannot find the controls | Link to email preferences from every notification email footer: "Manage your notification settings" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Sentry:** Often missing `onRequestError` hook — verify `instrumentation.ts` exports `onRequestError` and errors in Server Components appear in the Sentry dashboard.
- [ ] **Sentry:** Often missing source maps in production — verify a Sentry error event shows readable TypeScript file names, not minified code.
- [ ] **Sentry:** Often missing PII scrubbing — verify no email addresses appear in Sentry event context by intentionally triggering a webhook processing error and inspecting the event.
- [ ] **PostHog:** Often missing server-side events in production — verify a booking approval event appears in PostHog Live Events within seconds of a test webhook being processed.
- [ ] **PostHog:** Often missing page view tracking — verify navigation between dashboard pages creates distinct pageview events (Next.js requires explicit router-change listeners for SPA navigation).
- [ ] **Structured logging:** Often missing `server-only` guard — verify `import 'server-only'` is present in `lib/logger.ts` and the build does not bundle Pino for the client.
- [ ] **Structured logging:** Often missing old console.log calls — run `grep -r "console\.log\|console\.error\|console\.warn" src/app src/lib` after migration and verify zero results in production code.
- [ ] **Resend email:** Often missing domain verification confirmation — verify by sending a test email to a real inbox (not just asserting the API returns 200) before marking as done.
- [ ] **Vercel Cron:** Often missing idempotency — verify that running the cron handler twice against the same database state sends exactly one email and makes exactly one status change, not two.
- [ ] **Cron endpoint security:** Often missing secret header validation — verify a direct `curl` to the cron endpoint without the correct `Authorization` header returns 401, not 200.
- [ ] **Email preferences:** Often missing default state — verify new users have all notifications enabled by default without requiring explicit opt-in setup.
- [ ] **Trial expiry:** Often missing the "already expired" guard — verify users who are already on FREE tier (downgraded manually) do not receive trial expiry emails.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PII already transmitted to Sentry before scrubbing configured | MEDIUM | Enable Sentry data scrubbing rules in the Sentry dashboard (server-side scrub) immediately; add `beforeSend` to SDK config; file a Sentry support request to purge affected events if GDPR requires it |
| Source maps missing in production — all errors unreadable | LOW | Add `SENTRY_AUTH_TOKEN` to Vercel env; trigger a new deployment; historical events remain unreadable but new ones will have source maps |
| Trial expiry emails sent multiple times (cron ran twice) | LOW-MEDIUM | Send a correction email apologizing for the duplicate; add idempotency check before the next cron run; consider whether a Stripe webhook-based approach would be more reliable for future |
| Pino bundled into client — site broken in production | HIGH | Roll back the logging change; restructure logger into a server-only module; redeploy; add `serverExternalPackages` to `next.config.ts` |
| Resend domain not verified — emails failing silently for days | MEDIUM | Switch to Resend test mode temporarily; initiate domain verification; add explicit error surfacing to the sending utility so failures are visible in logs |
| Cron endpoint hit externally (no auth) — spurious downgrades triggered | HIGH | Add `CRON_SECRET` check immediately as a hotfix; audit database for incorrectly downgraded users; restore affected accounts manually via Stripe |
| PostHog server-side events being lost silently | LOW | Add `flushAt: 1, flushInterval: 0` to server PostHog config; add `await posthog.shutdown()` to each route; verify with PostHog Live Events view |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Sentry not capturing Server Component errors | Sentry setup phase | Intentionally throw in an RSC; confirm event in Sentry dashboard within 60 seconds |
| Sentry source maps broken on Vercel | Sentry setup phase | Deploy to preview; trigger an error; verify readable stack trace in Sentry |
| Sentry PII leak via request context | Sentry setup phase | Trigger a webhook error; inspect Sentry event for email addresses in context fields |
| PostHog provider destroys server rendering | PostHog setup phase | Build output shows RSC pages as `●`/`λ`, not all as client-rendered |
| PostHog server-side events lost in serverless | PostHog setup phase | Booking event appears in PostHog Live Events after test webhook |
| Pino breaks Edge Runtime or client bundle | Structured logging phase | `npm run build` succeeds; `next start` shows JSON logs; middleware does not throw |
| Console.log spies broken by logger migration | Structured logging phase | All existing tests pass after migration with no spy assertions vacuously green |
| Cron route statically generated | Trial expiry cron phase | Cron route shows as `λ` in build output; database changes after manual invocation |
| Trial expiry emails sent twice | Trial expiry cron phase | Two consecutive cron invocations against same data produce exactly one email and one DB update |
| Cron endpoint exposed without auth | Trial expiry cron phase | `curl` without auth header returns 401; Vercel cron invocation with correct header returns 200 |
| Resend domain not verified | Email setup phase | Test email received in real inbox (not just API 200 response) |
| Unsubscribe link forgeable | Email preferences phase | Unsubscribe link validation test: tampered token returns 400; valid token unsubscribes correct user only |

---

## Sources

- Sentry Next.js docs — `https://docs.sentry.io/platforms/javascript/guides/nextjs/` (fetched 2026-03-21, HIGH confidence)
- Sentry source maps for Next.js — `https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/` (HIGH confidence)
- Sentry sensitive data scrubbing — `https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/` (HIGH confidence)
- Sentry `onRequestError` discussion — `https://github.com/getsentry/sentry-javascript/discussions/13442` (MEDIUM confidence, GitHub discussion)
- PostHog Next.js docs — `https://posthog.com/docs/libraries/next-js` (HIGH confidence)
- PostHog Node.js docs — `https://posthog.com/docs/libraries/node` (HIGH confidence)
- PostHog GDPR compliance — `https://posthog.com/docs/privacy/gdpr-compliance` (HIGH confidence)
- PostHog session continuity issue — `https://github.com/PostHog/posthog-js/issues/3130` (MEDIUM confidence, GitHub issue)
- Vercel Cron Jobs docs — `https://vercel.com/docs/cron-jobs` (HIGH confidence)
- Vercel Cron troubleshooting — `https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs` (HIGH confidence)
- Pino Next.js App Router discussion — `https://github.com/vercel/next.js/discussions/46987` (MEDIUM confidence)
- Pino edge runtime issue — `https://github.com/vercel/next.js/discussions/67213` (MEDIUM confidence)
- Pino Next.js structured logging — `https://blog.arcjet.com/structured-logging-in-json-for-next-js/` (MEDIUM confidence)
- Resend Next.js docs — `https://resend.com/docs/send-with-nextjs` (HIGH confidence)
- Resend Vercel email delivery issues — `https://github.com/nextauthjs/next-auth/discussions/9148` (MEDIUM confidence, community discussion)

---
*Pitfalls research for: Production infrastructure retrofit — Sentry, PostHog, structured logging, transactional email, Vercel Cron (Protectly v1.0)*
*Researched: 2026-03-21*

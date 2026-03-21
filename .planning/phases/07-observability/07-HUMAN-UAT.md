---
status: partial
phase: 07-observability
source: [07-VERIFICATION.md]
started: 2026-03-21
updated: 2026-03-21
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sentry captures errors with readable stack trace
expected: An error thrown in a Server Component appears in Sentry within 60 seconds with TypeScript file/line references
result: [pending]

### 2. Source maps upload and resolve correctly
expected: Triggering a test error via preview deployment shows a stack trace pointing to .ts files, not minified code
result: [pending]

### 3. PostHog receives events in Live Events
expected: A booking webhook processed in production results in a booking_processed event visible in PostHog Live Events
result: [pending]

### 4. PostHog /ingest proxy bypasses ad-blockers
expected: PostHog events fire even with ad-blocker enabled (routed through /ingest proxy rewrite)
result: [pending]

### 5. Vercel log output is structured JSON
expected: All server-side log output in Vercel Runtime Logs is valid JSON with requestId, userId, and action fields
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

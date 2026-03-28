---
phase: 16-domain-api-webhook
plan: "02"
subsystem: webhook
tags: [domain-matching, security, webhook, tdd]
dependency_graph:
  requires: [15-01-SUMMARY.md]
  provides: [domain-hash-matching-in-webhook]
  affects: [src/app/api/webhooks/calendly/route.ts]
tech_stack:
  added: []
  patterns: [isHashInSet helper, domain extraction via split('@')[1], parallel hash sets]
key_files:
  created:
    - src/app/api/webhooks/calendly/webhook-domain.test.ts
  modified:
    - src/app/api/webhooks/calendly/route.ts
decisions:
  - "Domain hash checked after email hash inside isEmailApproved — single function handles both, no parallel branch"
  - "isHashInSet extracted as named helper for reuse across email and domain checks"
  - "domainEntries included with domainEntries: true (no filter) — DomainEntry has no expiry field"
metrics:
  duration: "4 minutes"
  completed: "2026-03-27"
  tasks_completed: 1
  files_changed: 2
---

# Phase 16 Plan 02: Webhook Domain Hash Matching Summary

## One-liner

Extended webhook isEmailApproved with domain hash matching — invitee and guest emails are approved if their domain (extracted via split('@')[1]) matches any SHA-256-hashed domain entry in allowedDomainHashes.

## What Was Built

### Task 1: Extend webhook isEmailApproved with domain hash matching

Modified `src/app/api/webhooks/calendly/route.ts` with three targeted changes:

**Change 1 — Prisma include block:** Added `domainEntries: true` to the allowlists include block. DomainEntry has no expiry field so all entries are included unconditionally.

**Change 2 — allowedDomainHashes Set:** Built alongside the existing `allowedEmailHashes` Set using the same SHA-256 hex digest pattern applied to each domain entry's lowercased domain string.

**Change 3 — isHashInSet + extended isEmailApproved:** Extracted `isHashInSet(candidateHex, hashSet)` as a named helper (reduces duplication, uses `crypto.timingSafeEqual`). The `isEmailApproved` function now:
1. Hashes the lowercased email and checks `allowedEmailHashes`
2. Extracts the domain part via `lowerEmail.split('@')[1]`
3. If domain exists, hashes it and checks `allowedDomainHashes`
4. Returns false only if both checks fail

The `evaluateGuestCheckMode` call site and `src/lib/guest-check.ts` were not modified — domain matching is transparent to the guest-check layer.

### Test File

Created `src/app/api/webhooks/calendly/webhook-domain.test.ts` with 13 tests covering:
- Domain hash set construction (Tests 1-2)
- isEmailApproved with domain matching: match, no match, email match still works, both match, malformed email (Tests 3-7)
- All 5 guest-check modes: STRICT (Tests 8-9), PRIMARY_ONLY (Test 10), ANY_APPROVED (Test 11), NO_GUESTS (Test 12), ALLOW_ALL (Test 13)

## Deviations from Plan

None — plan executed exactly as written. The recommended approach (option 2: test via full POST handler with mocked deps) was used. Test structure closely mirrors `route.test.ts` patterns.

## Verification

- `npx vitest run src/app/api/webhooks/calendly/webhook-domain` — 13/13 passed
- `npx vitest run src/app/api/webhooks/calendly/route.test` — 8/8 passed (no regressions)
- `src/lib/guest-check.ts` — unmodified (confirmed via git diff)
- Pre-existing failures in `posthog-server.test.ts`, `calendly.test.ts`, and `domains.test.ts` are unrelated to this plan

## Commits

- `9af0bd3` — test(16-02): add failing tests for domain hash matching in webhook handler (RED)
- `2d2afe5` — feat(16-02): extend webhook isEmailApproved with domain hash matching (GREEN)

## Known Stubs

None.

## Self-Check: PASSED

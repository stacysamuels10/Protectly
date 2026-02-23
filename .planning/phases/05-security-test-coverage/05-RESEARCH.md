# Phase 5: Security Test Coverage - Research

**Researched:** 2026-02-22
**Domain:** Vitest security test suites for webhook verification, Stripe lifecycle, allowlist ACL, guest check modes, and token refresh
**Confidence:** HIGH

## Summary

Phase 5 adds no production code. It writes Vitest test suites that cover every security-critical path hardened in Phases 1-4. The project already has a mature Vitest 4.0.16 setup with `happy-dom`, path aliases (`@/`), `vi.mock`/`vi.doMock` patterns, and 52 passing tests across 6 files. The existing test patterns provide strong precedent: `vi.mock('@/env')` for env isolation, `vi.mock('@/lib/encryption')` with `enc:v1:mocked:` prefix for crypto mocking, `vi.mock('@/lib/prisma')` for database isolation, and `vi.useFakeTimers()` for time-sensitive tests.

The work decomposes naturally into 5 test suites matching the 5 requirements (TST-01 through TST-05). Three suites (TST-01 webhook signatures, TST-04 guest check modes, TST-05 token refresh) can test pure or near-pure functions directly. TST-02 (Stripe lifecycle) and TST-03 (allowlist ACL) require mocking the POST handler integration path. The guest check mode logic (TST-04) is currently inline in the Calendly webhook handler and must be extracted into a pure function before testing -- this is the only refactoring the phase requires.

**Primary recommendation:** Extract the guest check mode `switch` block from `src/app/api/webhooks/calendly/route.ts` into a pure function (e.g., `evaluateGuestCheckMode` in `src/lib/guest-check.ts`), then write 5 focused test files using the project's established mocking patterns. No new dependencies needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TST-01 | Webhook signature validation tests: valid signature, invalid key, missing headers, tampered payload, 59s/61s timestamp boundary | `verifyWebhookSignature` and `isTimestampValid` in `src/lib/webhook.ts` are pure functions accepting string args -- directly testable with `crypto.createHmac`. Use `vi.useFakeTimers()` for timestamp boundary tests. |
| TST-02 | Stripe subscription lifecycle tests: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed, duplicate event idempotency | `POST` handler in `src/app/api/webhooks/stripe/route.ts` uses `stripe.webhooks.constructEvent` for verification and Prisma for state. Mock `@/lib/stripe` (constructEvent), `@/lib/prisma`, and `@/env`. Test each event type + P2002 duplicate path. |
| TST-03 | Allowlist permission enforcement: cross-user GET/POST/DELETE returns 403/404 | All allowlist handlers use `getCurrentUser()` then `prisma.allowlist.findFirst({ where: { id, userId: user.id } })`. Mock `@/lib/session` to return user B, mock Prisma to return null for user A's allowlist. Handlers return 404 (not 403) by design. |
| TST-04 | Guest check mode: 5 modes x 3 scenarios via extracted pure function | Guest check logic is inline in webhook handler (lines 185-241 of route.ts). Extract into `evaluateGuestCheckMode(mode, inviteeApproved, approvedGuests, unapprovedGuests, guestEmails)` pure function. 15 test cases become trivial assertions. |
| TST-05 | Calendly token refresh: 401 triggers refresh, retry succeeds, failed refresh handled gracefully | `calendlyRequest` in `src/lib/calendly.ts` already has 3 tests covering happy path, 401+refresh, and corrupted decrypt. Need to add: (a) failed refresh throws without crashing, (b) verify new token used on retry. Some overlap with existing `calendly.test.ts`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.16 | Test runner and assertion library | Already configured in project; vitest.config.ts, setupFiles, path aliases all working |
| happy-dom | 20.0.11 | DOM environment for tests | Already configured as test environment in vitest.config.ts |
| Node.js crypto | built-in | HMAC-SHA256 for webhook signature test fixture generation | Used by `src/lib/webhook.ts` -- tests need to create valid signatures using the same algorithm |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/jest-dom | 6.9.1 | Extended DOM matchers | Already in setup.ts; not needed for these tests (pure logic, no DOM) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mocking Stripe.webhooks.constructEvent | Using Stripe's test helpers | Stripe test helpers require real Stripe SDK initialization with API key; mocking is simpler and already the project pattern |
| Testing allowlist ACL via HTTP | Testing via direct function call | HTTP-level testing would require spinning up Next.js; mocking `getCurrentUser` and calling the exported handler function directly is the project pattern |

**Installation:**
```bash
# No new packages needed -- all test infrastructure already exists
```

## Architecture Patterns

### Recommended Test File Structure
```
src/
├── lib/
│   ├── webhook.test.ts          # TST-01: Webhook signature validation (NEW)
│   ├── guest-check.ts           # Extracted pure function (NEW)
│   ├── guest-check.test.ts      # TST-04: Guest check modes (NEW)
│   ├── calendly.test.ts         # TST-05: Extend existing tests (MODIFY)
│   ├── encryption.test.ts       # Existing (no changes)
│   └── utils.test.ts            # Existing (no changes)
├── app/api/
│   ├── webhooks/
│   │   ├── calendly/
│   │   │   └── route.test.ts    # Existing; update to use extracted guest-check (MODIFY)
│   │   └── stripe/
│   │       └── route.test.ts    # TST-02: Stripe lifecycle (NEW)
│   └── allowlists/
│       └── allowlists.test.ts   # TST-03: Cross-user ACL (NEW)
```

### Pattern 1: Pure Function Signature Verification Testing (TST-01)
**What:** `verifyWebhookSignature` and `isTimestampValid` are pure functions -- generate a valid HMAC signature in the test, then pass permutations.
**When to use:** When the function under test has no side effects and accepts all inputs as arguments.
**Example:**
```typescript
import crypto from 'crypto'
import { verifyWebhookSignature, isTimestampValid } from './webhook'

function makeSignature(payload: string, key: string, timestampSec: number): string {
  const signedPayload = `${timestampSec}.${payload}`
  const sig = crypto.createHmac('sha256', key).update(signedPayload, 'utf8').digest('hex')
  return `t=${timestampSec},v1=${sig}`
}

it('accepts a valid signature', () => {
  const key = 'test-key'
  const payload = '{"event":"invitee.created"}'
  const ts = Math.floor(Date.now() / 1000)
  const header = makeSignature(payload, key, ts)
  expect(verifyWebhookSignature(payload, header, key)).toBe(true)
})

it('rejects when timestamp is 61 seconds old', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  const ts = Math.floor(Date.now() / 1000) - 61  // 61s ago
  const header = `t=${ts},v1=abc`
  expect(isTimestampValid(header, 60000)).toBe(false)
  vi.useRealTimers()
})
```

### Pattern 2: Handler Integration Testing with Mocked Dependencies (TST-02, TST-03)
**What:** Import the exported `POST`/`GET`/`DELETE` handler function directly, mock all external dependencies (`@/lib/prisma`, `@/lib/stripe`, `@/lib/session`, `@/env`), create a mock `NextRequest`, call the handler, assert on the `NextResponse`.
**When to use:** When testing route handlers that have side effects via Prisma/Stripe/etc.
**Example (Stripe lifecycle):**
```typescript
vi.mock('@/env', () => ({ env: { STRIPE_WEBHOOK_SECRET: 'whsec_test' } }))
vi.mock('@/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent: vi.fn() } },
  mapStripeStatus: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: { create: vi.fn() },
    user: { update: vi.fn(), findFirst: vi.fn() },
  },
}))

import { POST } from './route'

function makeStripeRequest(body: string, sig = 'valid-sig') {
  return { text: async () => body, headers: { get: (n: string) => n === 'stripe-signature' ? sig : null } } as any
}
```

### Pattern 3: Extracted Pure Function Testing (TST-04)
**What:** Extract the guest check mode `switch` block into a standalone pure function that takes mode, inviteeApproved boolean, approvedGuests array, unapprovedGuests array, and guestEmails array, and returns `{ isApproved, rejectionReason, usesGuestCancelMessage }`.
**When to use:** When complex branching logic is embedded in a handler but has no I/O dependencies.
**Example:**
```typescript
// src/lib/guest-check.ts
export interface GuestCheckResult {
  isApproved: boolean
  rejectionReason: string
  useGuestCancelMessage: boolean
}

export function evaluateGuestCheckMode(
  mode: string,
  inviteeApproved: boolean,
  approvedGuests: string[],
  unapprovedGuests: string[],
  guestEmails: string[],
): GuestCheckResult { ... }
```

### Anti-Patterns to Avoid
- **Testing Stripe constructEvent internals:** Do NOT attempt to generate real Stripe signatures -- mock `stripe.webhooks.constructEvent` to return a fake event object. The Stripe SDK's internal signing algorithm is not public API.
- **Testing via HTTP requests to a running server:** Do NOT spin up a Next.js dev server. Call the exported handler functions directly with mock `NextRequest` objects.
- **Skipping the env mock:** Every test file that imports a module touching `@/env` MUST mock it first. The `@t3-oss/env-nextjs` createEnv fails immediately if env vars are missing at module load time.
- **Coupling guest check mode tests to the webhook handler:** The 15 guest check mode test cases should call the extracted pure function, NOT the full POST handler. Handler-level tests are slow, brittle, and require extensive mock setup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe event construction | Custom Stripe event signing | `vi.fn()` mock of `stripe.webhooks.constructEvent` | Stripe's signing algorithm is internal; mock the boundary |
| Webhook HMAC signatures for tests | Manual string concatenation | `crypto.createHmac('sha256', key).update().digest('hex')` helper function | Matches the production code exactly; avoids subtle encoding bugs |
| NextRequest mocking | Full HTTP request construction | Object literal with `text()`, `headers.get()`, `nextUrl` | The handlers only use these specific methods; minimal mocks are more maintainable |
| Time control | Manual Date.now() patching | `vi.useFakeTimers()` + `vi.setSystemTime()` | Vitest's built-in fake timer is battle-tested and handles both Date.now() and setTimeout |

**Key insight:** These tests are testing _our_ security logic, not third-party library behavior. Mock at the boundary (Stripe SDK, Prisma, session), test our code in the middle.

## Common Pitfalls

### Pitfall 1: Module Load-Time Side Effects from @/env
**What goes wrong:** Tests fail with "Missing required environment variable" before any test code runs.
**Why it happens:** `@t3-oss/env-nextjs` validates env vars at `import` time. If a module under test imports `@/env` (directly or transitively), and the mock hasn't been registered yet, Vitest crashes.
**How to avoid:** Place `vi.mock('@/env', () => ({ env: { ... } }))` at the top of the test file, BEFORE any `import` statement that touches `@/env`. Vitest hoists `vi.mock` calls automatically, but the mock factory must return all env vars used by the imported module chain.
**Warning signs:** `ZodError` or "Invalid environment variables" in test output before tests run.

### Pitfall 2: Timestamp Boundary Precision in Webhook Tests
**What goes wrong:** A test checking "59-second timestamp should be accepted" passes sometimes and fails at other times.
**Why it happens:** `isTimestampValid` compares `timestamp * 1000 >= Date.now() - toleranceMs`. If the test doesn't freeze time, `Date.now()` advances during execution. A 59-second-old timestamp could become 60 or 61 seconds old by the time the assertion runs.
**How to avoid:** Always use `vi.useFakeTimers()` and `vi.setSystemTime()` for timestamp boundary tests. Calculate the timestamp relative to the frozen time, not `Date.now()`.
**Warning signs:** Tests pass in isolation but fail in CI or when run with the full suite.

### Pitfall 3: Prisma P2002 Mock for Idempotency Tests
**What goes wrong:** Idempotency test doesn't exercise the duplicate detection path because the mock just resolves.
**Why it happens:** The production code catches `Prisma.PrismaClientKnownRequestError` with code `P2002`. A simple `mockRejectedValue(new Error(...))` won't match the `instanceof` check.
**How to avoid:** Import `Prisma` from `@prisma/client` and construct the error correctly:
```typescript
import { Prisma } from '@prisma/client'
const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
  code: 'P2002',
  clientVersion: '5.7.1',
})
mockPrismaProcessedWebhookEvent.create.mockRejectedValueOnce(p2002)
```
**Warning signs:** The duplicate event test passes but the `if (error.code === 'P2002')` branch is never exercised.

### Pitfall 4: Allowlist ACL Tests Return 404, Not 403
**What goes wrong:** Test asserts `status: 403` for cross-user access, but the handler returns 404.
**Why it happens:** The allowlist handlers use `prisma.allowlist.findFirst({ where: { id, userId: user.id } })`. When user B accesses user A's allowlist, `findFirst` returns `null` (because userId doesn't match), and the handler returns `{ error: 'Allowlist not found' }, { status: 404 }`. This is intentional -- it doesn't leak information about whether the allowlist exists.
**How to avoid:** Assert 404 (not 403) in cross-user tests. The requirement says "returns 403 or 404" -- this codebase uses 404.
**Warning signs:** None if you read the handler code first.

### Pitfall 5: Duplicate vi.mock Declarations for Same Module
**What goes wrong:** Two `vi.mock('@/lib/prisma')` calls in the same file cause the second to silently override the first, losing mock methods from the first declaration.
**Why it happens:** Vitest hoists all `vi.mock` calls and applies them in order. The existing `route.test.ts` file has this issue (two separate `vi.mock('@/lib/prisma')` declarations). It works because the second one is a superset of the first.
**How to avoid:** Declare each module's mock exactly once with all needed methods.
**Warning signs:** `undefined is not a function` errors on mock methods that appear to be defined.

### Pitfall 6: The 4-Second Cancellation Delay in Webhook Handler
**What goes wrong:** Tests hang for 4 seconds per unapproved booking test case.
**Why it happens:** The Calendly webhook handler has `await new Promise(resolve => setTimeout(resolve, 4000))` before cancellation.
**How to avoid:** Use `vi.useFakeTimers()` before calling `POST`, then `await vi.runAllTimersAsync()` to fast-forward. The existing `route.test.ts` already demonstrates this pattern.
**Warning signs:** Test suite takes 20+ seconds; individual tests timeout.

## Code Examples

### Example 1: Webhook Signature Test Helper
```typescript
// Used across TST-01 tests
import crypto from 'crypto'

function makeValidSignature(payload: string, key: string, timestampSec?: number): string {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000)
  const signedPayload = `${ts}.${payload}`
  const sig = crypto.createHmac('sha256', key).update(signedPayload, 'utf8').digest('hex')
  return `t=${ts},v1=${sig}`
}
```

### Example 2: Stripe Event Factory for TST-02
```typescript
function makeStripeEvent(type: string, data: Record<string, unknown>, id = 'evt_test_123'): any {
  return { id, type, data: { object: data } }
}

// checkout.session.completed
const checkoutEvent = makeStripeEvent('checkout.session.completed', {
  metadata: { userId: 'user-1', tier: 'PRO' },
  subscription: 'sub_123',
  customer: 'cus_123',
})

// customer.subscription.deleted
const deletionEvent = makeStripeEvent('customer.subscription.deleted', {
  metadata: { userId: 'user-1' },
  status: 'canceled',
})

// invoice.payment_failed
const failedPaymentEvent = makeStripeEvent('invoice.payment_failed', {
  subscription: 'sub_123',
})
```

### Example 3: Guest Check Mode Pure Function Extraction
```typescript
// src/lib/guest-check.ts
import type { GuestCheckMode } from '@prisma/client'

export interface GuestCheckResult {
  isApproved: boolean
  rejectionReason: string
  useGuestCancelMessage: boolean
}

export function evaluateGuestCheckMode(
  mode: GuestCheckMode,
  inviteeApproved: boolean,
  approvedGuests: string[],
  unapprovedGuests: string[],
  guestEmails: string[],
): GuestCheckResult {
  switch (mode) {
    case 'ALLOW_ALL':
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }
    case 'STRICT':
      if (!inviteeApproved) return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      if (unapprovedGuests.length > 0) return { isApproved: false, rejectionReason: `Unapproved guest(s): ${unapprovedGuests.join(', ')}`, useGuestCancelMessage: true }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }
    case 'PRIMARY_ONLY':
      return { isApproved: inviteeApproved, rejectionReason: inviteeApproved ? '' : 'Email not on allowlist', useGuestCancelMessage: false }
    case 'ANY_APPROVED':
      const anyApproved = inviteeApproved || approvedGuests.length > 0
      return { isApproved: anyApproved, rejectionReason: anyApproved ? '' : 'No participants on allowlist', useGuestCancelMessage: false }
    case 'NO_GUESTS':
      if (!inviteeApproved) return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      if (guestEmails.length > 0) return { isApproved: false, rejectionReason: `Additional guests not allowed: ${guestEmails.join(', ')}`, useGuestCancelMessage: true }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }
    default:
      // Fallback to strict
      if (!inviteeApproved) return { isApproved: false, rejectionReason: 'Email not on allowlist', useGuestCancelMessage: false }
      if (unapprovedGuests.length > 0) return { isApproved: false, rejectionReason: `Unapproved guest(s): ${unapprovedGuests.join(', ')}`, useGuestCancelMessage: true }
      return { isApproved: true, rejectionReason: '', useGuestCancelMessage: false }
  }
}
```

### Example 4: Cross-User Allowlist ACL Test (TST-03)
```typescript
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    allowlist: { findFirst: vi.fn(), findMany: vi.fn() },
    allowlistEntry: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { getCurrentUser } from '@/lib/session'

// user B is authenticated
vi.mocked(getCurrentUser).mockResolvedValue({
  id: 'user-b',
  email: 'b@example.com',
  subscriptionTier: 'FREE',
  // ... other fields
} as any)

// user A's allowlist - prisma returns null because userId doesn't match
vi.mocked(prisma.allowlist.findFirst).mockResolvedValue(null)

// GET returns 404
const { GET } = await import('@/app/api/allowlists/[id]/entries/route')
const response = await GET(mockRequest, { params: Promise.resolve({ id: 'user-a-allowlist-id' }) })
expect(response.status).toBe(404)
```

### Example 5: Stripe Idempotency Duplicate Test (TST-02)
```typescript
import { Prisma } from '@prisma/client'

it('returns 200 without processing when event is a duplicate', async () => {
  const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.7.1',
  })
  mockProcessedWebhookEvent.create.mockRejectedValueOnce(p2002)

  mockConstructEvent.mockReturnValue(makeStripeEvent('checkout.session.completed', { ... }, 'evt_dup_1'))

  const response = await POST(makeStripeRequest('{}'))

  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.received).toBe(true)
  // user.update should NOT have been called -- event was skipped
  expect(mockPrismaUserUpdate).not.toHaveBeenCalled()
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vi.mock` for all module mocks | `vi.doMock` for mocks needing `resetModules()` compat | Vitest 1.x+ | Use `vi.mock` for standard cases, `vi.doMock` only when `vi.resetModules()` is used (see middleware.test.ts pattern) |
| Vitest `globals: false` (explicit imports) | `globals: true` in this project | Project config | `describe`, `it`, `expect`, `vi`, `beforeEach` are globally available but still explicitly imported in existing tests for clarity |
| Jest-style `mockImplementation` chaining | Vitest `vi.mocked()` type-safe wrapper | Vitest 1.x+ | Use `vi.mocked(fn)` for type-safe mock access as shown in existing `calendly.test.ts` |

**Deprecated/outdated:**
- Vitest's `vi.mock` with `vi.fn()` factory returning async modules: not needed here, all mocked modules are synchronous

## Open Questions

1. **Allowlist ACL test: Should we test GET on `/api/allowlists` (list) or only on `/api/allowlists/[id]/entries` (entries)?**
   - What we know: The top-level `GET /api/allowlists` only uses `getCurrentUser()` and filters by `userId` -- there's no `id` parameter, so cross-user access is inherently impossible. The `[id]/entries` routes are the ones with explicit ownership checks.
   - What's unclear: Does the requirement intend both levels or just the entry-level?
   - Recommendation: Test the `[id]/entries` GET, `[id]/entries` POST, and `[id]/entries/[entryId]` DELETE -- these are the endpoints where a user supplies another user's resource ID. Include the top-level GET as a bonus if time permits.

2. **TST-05: How much overlap with existing calendly.test.ts?**
   - What we know: The existing `calendly.test.ts` already covers: (a) happy path decrypt+request, (b) 401 triggers refresh with encrypted tokens, (c) corrupted decrypt propagates error. These partially satisfy TST-05.
   - What's unclear: Whether the existing tests are sufficient or TST-05 requires additional explicit cases (e.g., failed refresh throwing without crashing).
   - Recommendation: Add one test case for "refreshAccessToken throws, error propagates without crashing handler" to `calendly.test.ts`. The existing tests already cover the 401-trigger-refresh and retry-with-new-token paths. Minimal additions needed.

3. **Should the guest check extraction refactor be a separate plan or included in the TST-04 plan?**
   - What we know: Extracting the pure function is a prerequisite for testing. It changes production code (route.ts imports from guest-check.ts).
   - What's unclear: Whether the planner prefers one plan with extraction + tests or two plans.
   - Recommendation: Include extraction as the first task of the TST-04 plan. It's a mechanical refactor (cut-paste + import), not a feature change. One plan keeps the context tight.

## Sources

### Primary (HIGH confidence)
- **Project codebase** - Direct inspection of all source files:
  - `src/lib/webhook.ts` (pure functions: `verifyWebhookSignature`, `isTimestampValid`)
  - `src/lib/calendly.ts` (`calendlyRequest` with token refresh logic)
  - `src/lib/stripe.ts` (`stripe` instance, `mapStripeStatus`)
  - `src/app/api/webhooks/calendly/route.ts` (Calendly webhook handler with guest check modes)
  - `src/app/api/webhooks/stripe/route.ts` (Stripe webhook handler with idempotency)
  - `src/app/api/allowlists/*/route.ts` (3 files: list, entries, entry operations)
  - `src/lib/session.ts` (`getCurrentUser` session helper)
  - `prisma/schema.prisma` (User model with GuestCheckMode enum, ProcessedWebhookEvent model)
- **Existing test files** - 6 files, 52 tests passing:
  - `src/lib/calendly.test.ts` (3 tests: decrypt/refresh/error patterns)
  - `src/app/api/webhooks/calendly/route.test.ts` (2 tests: cancelBookingWithRetry via handler)
  - `middleware.test.ts` (5 tests: rate limiting with `vi.doMock` + `resetModules`)
  - `src/lib/encryption.test.ts`, `src/lib/utils.test.ts`, `src/components/ui/button.test.tsx`
- **vitest.config.ts** - Environment: `happy-dom`, setup: `src/test/setup.ts`, path alias: `@/ -> src/`
- **package.json** - Vitest 4.0.16, Stripe 14.25.0, Prisma 5.7.1, happy-dom 20.0.11

### Secondary (MEDIUM confidence)
- **Vitest documentation** - `vi.useFakeTimers()`, `vi.setSystemTime()`, `vi.mock()` hoisting behavior confirmed from training knowledge, consistent with observed project behavior

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already installed and configured; no new dependencies
- Architecture: HIGH - Direct inspection of all source files and all 6 existing test files; test patterns are consistent and well-established
- Pitfalls: HIGH - Identified from reading production code and existing test patterns; the env mock pitfall and P2002 mock pitfall are evidenced by existing test workarounds

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable -- no version changes expected)

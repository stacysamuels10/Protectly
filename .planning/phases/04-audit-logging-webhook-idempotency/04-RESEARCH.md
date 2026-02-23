# Phase 4: Audit Logging & Webhook Idempotency - Research

**Researched:** 2026-02-22
**Domain:** Prisma audit logging, webhook event deduplication, PostgreSQL idempotency patterns
**Confidence:** HIGH

## Summary

Phase 4 addresses two distinct but complementary concerns: (1) recording every allowlist mutation in an immutable audit log (ACL-02), and (2) preventing duplicate webhook event processing for both Calendly and Stripe (WHK-02). Both require new Prisma models and schema migrations, but the implementation patterns are fundamentally different -- audit logging is a write-side concern at the API route level, while webhook idempotency is a read-then-skip guard at the webhook handler entry point.

The audit log requires a new `AuditLog` model in `schema.prisma` with fields for `userId`, `action` (enum: ADD, REMOVE, BULK_IMPORT, CLEAR), `targetEmail`, and `timestamp`. The webhook idempotency requires a `ProcessedWebhookEvent` model with a unique constraint on an idempotency key (Calendly: invitee URI, Stripe: event ID). Both are standard PostgreSQL patterns that Prisma handles well.

The key architectural decision is where to place audit logging -- the recommendation is direct insertion at each API route handler (not Prisma middleware/extensions) because: (a) audit logs need `userId` from the session which is not available in Prisma extensions, (b) there are only 3-4 mutation points to instrument, and (c) the audit record must persist even if the subsequent operation fails (write-audit-first pattern).

**Primary recommendation:** Use explicit audit log inserts in each allowlist mutation route, and use Prisma `findUnique` + unique constraint on idempotency keys for webhook deduplication -- no third-party libraries, no Prisma extensions, no PostgreSQL triggers.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACL-02 | All allowlist changes (add, remove, bulk import, clear) are recorded in an audit log with userId, action, target, and timestamp | New `AuditLog` Prisma model; explicit inserts in `src/app/api/allowlists/[id]/entries/route.ts` (POST) and `src/app/api/allowlists/[id]/entries/[entryId]/route.ts` (DELETE); write-audit-first pattern ensures persistence even on subsequent failure |
| WHK-02 | Duplicate webhook events are detected and skipped via idempotency key tracking (Calendly: invitee URI, Stripe: event ID) | New `ProcessedWebhookEvent` Prisma model with unique constraint on idempotency key; early-return guard in both `src/app/api/webhooks/calendly/route.ts` and `src/app/api/webhooks/stripe/route.ts`; uses Prisma `create` with try/catch on unique constraint violation for race-safe deduplication |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 5.22.0 (installed) | ORM for AuditLog and ProcessedWebhookEvent models | Already the project's ORM; no additional dependencies needed |
| prisma | 5.22.0 (installed) | Schema migrations for new tables | Standard migration tooling already in use |
| zod | 3.22.4 (installed) | Request validation for audit action types | Already used across all API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No additional libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct route-level audit inserts | Prisma `$extends` query component | Extensions cannot access session/userId context; would need `forUser()` wrapper pattern with transaction overhead; adds complexity for 3-4 mutation points |
| Direct route-level audit inserts | Prisma `$use` middleware (legacy) | Marked legacy in Prisma 5; deprecated in favor of `$extends`; no type safety; same session context problem |
| Direct route-level audit inserts | PostgreSQL triggers | Overkill for 3-4 mutation points; harder to test; requires raw SQL migrations; can't easily capture application-level userId |
| Prisma unique constraint for dedup | Redis SET with TTL | Adds Redis dependency for dedup when PostgreSQL handles it natively; project already has optional Upstash but making dedup depend on it would mean dedup fails when Upstash is unavailable |
| Try/catch on unique constraint | `findUnique` then `create` (check-then-act) | Race condition: two concurrent webhook deliveries could both pass the check before either creates the record; try/catch on unique constraint violation is atomic and race-safe |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
npx prisma migrate dev --name add-audit-log-and-webhook-idempotency
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
├── schema.prisma          # Add AuditLog + ProcessedWebhookEvent models
└── migrations/
    └── YYYYMMDD_add_audit_log_and_webhook_idempotency/
        └── migration.sql
src/
├── app/api/
│   ├── allowlists/
│   │   └── [id]/entries/
│   │       ├── route.ts           # Add audit log on POST (ADD action)
│   │       └── [entryId]/
│   │           └── route.ts       # Add audit log on DELETE (REMOVE action)
│   └── webhooks/
│       ├── calendly/route.ts      # Add idempotency check (invitee URI)
│       └── stripe/route.ts        # Add idempotency check (event.id)
```

### Pattern 1: Write-Audit-First for Allowlist Mutations
**What:** Create the audit log record BEFORE performing the mutation, so the audit trail persists even if the mutation fails.
**When to use:** Every allowlist write operation (add, remove).
**Example:**
```typescript
// In POST handler for adding entries (src/app/api/allowlists/[id]/entries/route.ts)
// For each successfully validated email, BEFORE creating the AllowlistEntry:

// 1. Write audit record first
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'ADD',
    targetEmail: normalizedEmail,
    allowlistId: id,
  },
})

// 2. Then create the entry
await prisma.allowlistEntry.create({
  data: {
    allowlistId: id,
    email: normalizedEmail,
    name: name || null,
    notes: notes || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    addedById: user.id,
  },
})
```

### Pattern 2: Idempotency via Unique Constraint Violation (Race-Safe)
**What:** Attempt to INSERT the idempotency key; if a unique constraint violation occurs (Prisma error code P2002), the event is a duplicate -- return 200 immediately.
**When to use:** Every webhook handler, immediately after signature verification and before any business logic.
**Example:**
```typescript
// In Calendly webhook handler, after signature verification:
const inviteeUri = payload.payload.uri  // e.g., https://api.calendly.com/.../invitees/INV001

try {
  await prisma.processedWebhookEvent.create({
    data: {
      idempotencyKey: inviteeUri,
      source: 'CALENDLY',
      eventType: payload.event,
    },
  })
} catch (error: any) {
  // Prisma unique constraint violation = duplicate event
  if (error.code === 'P2002') {
    console.log('[Calendly Webhook] Duplicate event detected, skipping:', inviteeUri)
    return NextResponse.json({ received: true, duplicate: true })
  }
  throw error  // Re-throw unexpected errors
}

// In Stripe webhook handler, after constructEvent:
try {
  await prisma.processedWebhookEvent.create({
    data: {
      idempotencyKey: event.id,  // Stripe event ID, e.g., evt_1234567890
      source: 'STRIPE',
      eventType: event.type,
    },
  })
} catch (error: any) {
  if (error.code === 'P2002') {
    console.log('[Stripe Webhook] Duplicate event detected, skipping:', event.id)
    return NextResponse.json({ received: true })
  }
  throw error
}
```

### Pattern 3: Prisma Schema for New Models
**What:** Two new models -- `AuditLog` (immutable append-only) and `ProcessedWebhookEvent` (idempotency store).
**When to use:** Added to `prisma/schema.prisma` and deployed via migration.
**Example:**
```prisma
enum AuditAction {
  ADD
  REMOVE
  BULK_IMPORT
  CLEAR
}

// Immutable audit log for allowlist mutations
model AuditLog {
  id          String      @id @default(uuid())
  userId      String
  action      AuditAction
  targetEmail String      @db.VarChar(255)
  allowlistId String?
  metadata    Json?       // Optional: extra context (e.g., bulk import count)
  createdAt   DateTime    @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([allowlistId])
  @@map("audit_logs")
}

enum WebhookSource {
  CALENDLY
  STRIPE
}

// Processed webhook events for idempotency
model ProcessedWebhookEvent {
  id              String        @id @default(uuid())
  idempotencyKey  String        @unique
  source          WebhookSource
  eventType       String        @db.VarChar(100)
  processedAt     DateTime      @default(now())

  @@index([source, processedAt])
  @@map("processed_webhook_events")
}
```

### Anti-Patterns to Avoid
- **Audit-after-mutation:** Writing the audit log AFTER the mutation means a crash between the two operations leaves the mutation unaudited. Always write-audit-first.
- **Check-then-act deduplication:** Using `findUnique` before `create` for idempotency has a TOCTOU race condition. Two concurrent requests can both find no record, then both attempt to create. Use the unique constraint violation pattern instead.
- **Prisma `$extends` for audit logging:** The query extension component does not have access to HTTP request context (session, userId). Passing context through would require a `forUser()` factory pattern that wraps every query in a transaction -- unnecessary complexity for 3-4 mutation points.
- **Soft-delete or mutable audit logs:** The AuditLog model must be append-only. No `update` or `delete` operations should ever be performed on it. Do not add `updatedAt` to the model.
- **Using `deleteMany` result count for audit:** When removing an entry, log the REMOVE audit record based on the entry data fetched before deletion, not on the `deleteMany` result.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotency key storage | In-memory Set or Map | PostgreSQL table with unique constraint via Prisma | Survives server restarts; race-safe via constraint violation; no TTL management needed |
| UUID generation | Custom ID generator | Prisma `@default(uuid())` | Standard, collision-resistant, already used across all models |
| Timestamp generation | `new Date()` in application code | Prisma `@default(now())` | Database-generated timestamps are consistent regardless of application server clock |
| Audit log querying | Custom SQL | Prisma `findMany` with standard filters | Index on `[userId, createdAt]` handles the primary query pattern efficiently |

**Key insight:** Both audit logging and webhook idempotency are solved by standard PostgreSQL INSERT patterns. The complexity is in the placement (where in the code to insert), not in the mechanism (how to insert).

## Common Pitfalls

### Pitfall 1: Race Condition in Webhook Deduplication
**What goes wrong:** Using `findUnique` then `create` (check-then-act) allows two concurrent webhook deliveries to both pass the dedup check, resulting in double processing.
**Why it happens:** Webhooks can be retried rapidly; two deliveries can arrive within milliseconds of each other.
**How to avoid:** Use the atomic INSERT-or-fail pattern: attempt `prisma.processedWebhookEvent.create()`, catch Prisma error code `P2002` (unique constraint violation) to detect duplicates.
**Warning signs:** Duplicate booking cancellations in the activity log, duplicate subscription state updates.

### Pitfall 2: Audit Log Written After Mutation
**What goes wrong:** If the server crashes between the mutation and the audit log write, the mutation is unaudited.
**Why it happens:** Natural coding tendency is to do the action first, then log it.
**How to avoid:** Write the audit record FIRST, then perform the mutation. If the mutation fails, the audit record shows an attempted action -- this is acceptable and preferable to a silent mutation.
**Warning signs:** Allowlist entries appearing without corresponding audit records.

### Pitfall 3: Forgetting to Handle Bulk Operations in Audit Log
**What goes wrong:** The POST handler for entries accepts an `emails` array (bulk add). Each email in the array must generate its own audit record, not a single record for the batch.
**Why it happens:** Looking at the route, the handler loops over emails individually -- the audit insert must be inside the loop, not outside.
**How to avoid:** Audit each email individually inside the existing loop in the POST handler. For bulk operations, consider the BULK_IMPORT action type with metadata containing the count.
**Warning signs:** Audit log shows one record for a 50-email import.

### Pitfall 4: Prisma Error Code Format
**What goes wrong:** Checking `error.code === 'P2002'` fails because the error object structure is unexpected.
**Why it happens:** Prisma wraps errors in `PrismaClientKnownRequestError` with a `code` property. The type needs to be checked correctly.
**How to avoid:** Import `Prisma` from `@prisma/client` and use `error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'` for type-safe error handling.
**Warning signs:** Duplicate events causing 500 errors instead of being silently skipped.

### Pitfall 5: Calendly Invitee URI vs Event URI for Idempotency
**What goes wrong:** Using the wrong URI as the idempotency key. The `scheduled_event.uri` (event URI) is shared across all invitees of a group event, so using it would block legitimate additional invitees. The `payload.uri` (invitee URI) is unique per invitee.
**Why it happens:** Confusion between the two URI fields in the Calendly webhook payload.
**How to avoid:** Use `payload.payload.uri` (the invitee URI, e.g., `https://api.calendly.com/scheduled_events/EVT001/invitees/INV001`) as the idempotency key -- this is what the requirements specify ("same invitee URI").
**Warning signs:** Group bookings with multiple invitees being incorrectly deduplicated after the first invitee.

### Pitfall 6: Stripe Webhook Using process.env Instead of env
**What goes wrong:** The current Stripe webhook handler uses `process.env.STRIPE_WEBHOOK_SECRET!` instead of the typed `env.STRIPE_WEBHOOK_SECRET`.
**Why it happens:** This file was not updated during Phase 1's env migration.
**How to avoid:** While adding idempotency, fix this to use `env.STRIPE_WEBHOOK_SECRET` from `@/env`. Note this is a separate concern but should be cleaned up since the file is being modified.
**Warning signs:** TypeScript non-null assertion (`!`) on env var access.

## Code Examples

Verified patterns from Prisma documentation and project conventions:

### Prisma P2002 Error Handling (Race-Safe Idempotency)
```typescript
// Source: Prisma docs - Error reference
// https://www.prisma.io/docs/orm/reference/error-reference#p2002
import { Prisma } from '@prisma/client'

try {
  await prisma.processedWebhookEvent.create({
    data: {
      idempotencyKey: eventId,
      source: 'STRIPE',
      eventType: eventType,
    },
  })
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    // Duplicate -- silently skip
    return NextResponse.json({ received: true })
  }
  throw error
}
```

### Audit Log Insert Pattern (Matching Project Conventions)
```typescript
// Follows the same pattern as BookingAttempt creation in calendly/route.ts
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'ADD',         // AuditAction enum
    targetEmail: normalizedEmail,
    allowlistId: id,
  },
})
```

### Prisma Migration Command
```bash
# Generate migration for new models
npx prisma migrate dev --name add_audit_log_and_processed_webhook_events

# Apply in production
npx prisma migrate deploy
```

### Test Pattern: Verifying Audit Log Creation
```typescript
// Following project test conventions from route.test.ts
// Mock prisma.auditLog.create
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
    allowlistEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    allowlist: {
      findFirst: vi.fn(),
    },
  },
}))

// Assert audit log was created with correct action
expect(mockPrismaAuditLogCreate).toHaveBeenCalledWith({
  data: expect.objectContaining({
    userId: 'user-123',
    action: 'ADD',
    targetEmail: 'test@example.com',
  }),
})
```

### Test Pattern: Verifying Idempotency (Duplicate Skipped)
```typescript
import { Prisma } from '@prisma/client'

// Simulate duplicate by making create throw P2002
const duplicateError = new Prisma.PrismaClientKnownRequestError(
  'Unique constraint failed',
  { code: 'P2002', clientVersion: '5.22.0', meta: { target: ['idempotencyKey'] } }
)
mockPrismaProcessedWebhookEventCreate.mockRejectedValueOnce(duplicateError)

// Send the same webhook twice
const response = await POST(makeRequest(makeWebhookPayload()))
const data = await response.json()

// Should return 200 (not error), and cancel should NOT have been called
expect(response.status).toBe(200)
expect(mockCancelCalendlyEvent).not.toHaveBeenCalled()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma `$use` middleware | Prisma `$extends` query component | Prisma 4.16+ (2023) | `$use` is legacy; `$extends` is type-safe and composable |
| Application-level check-then-act | Database-level unique constraint for idempotency | Standard practice | Eliminates TOCTOU race conditions |
| Separate audit database | Same database, separate table | N/A for this project scale | Simplicity; single transaction boundary; good enough for current traffic |

**Deprecated/outdated:**
- `prisma.$use()`: Legacy middleware API in Prisma 5; replaced by `$extends` query component. Not recommended for new code.
- `ON CONFLICT DO NOTHING` via raw SQL: While valid, Prisma's `create` + catch P2002 achieves the same atomicity without raw queries.

## Open Questions

1. **Processed webhook event cleanup/TTL**
   - What we know: The `processed_webhook_events` table will grow indefinitely. Calendly retries webhooks within a 30-day window; Stripe retries within 72 hours.
   - What's unclear: Whether to add a periodic cleanup job or if the table size is negligible for the expected traffic volume.
   - Recommendation: Defer cleanup to v2 (OPS-02). At current traffic levels, even 100K rows is trivial for PostgreSQL. Add a `processedAt` index to support future cleanup queries (already included in schema above).

2. **Bulk import and clear operations**
   - What we know: ACL-02 requires audit logging for "bulk import" and "clear" operations. The current codebase POST handler handles arrays (which is effectively bulk import). There is no explicit "clear all" endpoint currently.
   - What's unclear: Whether to add a CLEAR action for a future "clear all" endpoint, or only implement ADD and REMOVE for existing routes.
   - Recommendation: Define the `AuditAction` enum with all four values (ADD, REMOVE, BULK_IMPORT, CLEAR) for forward-compatibility, but only implement ADD and REMOVE in the current routes. The existing POST handler's loop already handles bulk adds by creating one audit record per email with action ADD.

3. **Stripe process.env usage**
   - What we know: `src/app/api/webhooks/stripe/route.ts` line 67 uses `process.env.STRIPE_WEBHOOK_SECRET!` instead of the typed `env` object.
   - What's unclear: Whether to fix this as part of Phase 4 or leave it for Phase 5/6.
   - Recommendation: Fix it during Phase 4 since the file is already being modified for idempotency. It is a one-line change (`env.STRIPE_WEBHOOK_SECRET`).

## Sources

### Primary (HIGH confidence)
- Prisma Client Extensions documentation: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query -- verified query component API, `$allModels`, `$allOperations` signatures
- Prisma Error Reference P2002: https://www.prisma.io/docs/orm/reference/error-reference#p2002 -- unique constraint violation error code and `PrismaClientKnownRequestError` class
- Prisma official audit-log-context example: https://github.com/prisma/prisma-client-extensions/tree/main/audit-log-context -- confirmed trigger-based approach is for complex scenarios; simple insert is sufficient for this use case
- Codebase inspection: `prisma/schema.prisma`, all webhook and allowlist route files (5 files read in full), `src/lib/calendly.ts` CalendlyWebhookPayload type, `src/lib/stripe.ts`, `src/env.ts`
- Installed Prisma version confirmed: 5.22.0 via `npx prisma --version`

### Secondary (MEDIUM confidence)
- Hookdeck webhook idempotency guide: https://hookdeck.com/webhooks/guides/implement-webhook-idempotency -- confirmed unique constraint violation pattern as standard practice
- Stripe idempotent requests documentation: https://docs.stripe.com/api/idempotent_requests -- confirmed event.id as the standard deduplication key for webhooks
- Calendly developer docs on webhook payloads: https://developer.calendly.com/receive-data-from-scheduled-events-in-real-time-with-webhook-subscriptions -- confirmed invitee URI format and uniqueness

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed; all patterns use existing Prisma + PostgreSQL
- Architecture: HIGH -- Direct route-level inserts are the simplest correct approach; codebase already follows this pattern (see BookingAttempt creation in calendly webhook handler)
- Pitfalls: HIGH -- Race condition in dedup is well-documented; P2002 pattern is standard Prisma; invitee URI vs event URI verified against CalendlyWebhookPayload type definition

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain; Prisma 5 API is GA and unlikely to change)

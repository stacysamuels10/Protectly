# Phase 16: Domain API + Webhook - Research

**Researched:** 2026-03-26
**Domain:** Next.js API Routes + Prisma + Webhook handler extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Accept input with or without `@` prefix — normalize to lowercase without `@` on storage (e.g. both `@company.com` and `company.com` → stored as `company.com`)

**D-02:** Subdomains are accepted as separate entries — `mail.company.com` is valid and distinct from `company.com`. No wildcard expansion.

**D-03:** Block common free email providers entirely (gmail.com, outlook.com, yahoo.com, hotmail.com, aol.com, icloud.com, protonmail.com, etc.) — server-side reject with clear error message.

**D-04:** Invalid formats rejected: bare `@`, `@.com`, domains without a dot, domains with spaces, domains longer than 253 chars. Use Zod schema with regex.

**D-05:** Domain routes live at `/api/allowlists/[id]/domains/` — parallel to existing `/entries/` path.

**D-06:** POST accepts array: `{ domains: ["company.com", "partner.org"] }` — consistent with email entries API pattern.

**D-07:** DELETE at `/api/allowlists/[id]/domains/[domainId]` — same pattern as entry deletion.

**D-08:** Follow existing patterns: ownership check, Zod safeParse, tier limit enforcement (`TIER_LIMITS[tier].domainEntries`), audit log written FIRST (action: ADD_DOMAIN/REMOVE_DOMAIN), PostHog event tracking.

**D-09:** Use timing-safe hash comparison for domains — build a parallel `allowedDomainHashes` Set alongside `allowedEmailHashes`.

**D-10:** Load domain entries in the same Prisma include block as email entries — single query, two hash sets built from results.

**D-11:** For each incoming email: first check email hash set, then extract domain (`email.split('@')[1]`), hash it, check domain hash set. Approved if either matches.

**D-12:** Domain matching applies to invitee email AND all guest emails — feeds into `evaluateGuestCheckMode` exactly like email matching (the `isEmailApproved` function becomes "is email OR domain approved").

### Claude's Discretion

- Exact Zod regex pattern for domain validation
- List of blocked free email providers (minimum: gmail.com, outlook.com, yahoo.com, hotmail.com, aol.com, icloud.com)
- Error message wording for blocked providers
- PostHog event names for domain add/remove

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOM-04 | Webhook booking check matches invitee email against domain entries (including guest emails under all 5 check modes) | Webhook handler extension pattern documented; `isEmailApproved` extension approach confirmed from reading live code; all 5 modes (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL) pass through `evaluateGuestCheckMode` unchanged |
</phase_requirements>

---

## Summary

Phase 16 is a pure extension phase: it adds two new API routes (POST and DELETE for domain entries) and modifies the Calendly webhook handler to check domain entries alongside email entries. All patterns are already established in the codebase — this phase follows them exactly rather than introducing anything new.

The webhook handler is the highest-risk change. The `isEmailApproved` closure (lines 178-190 of `route.ts`) must be extended to also check an `allowedDomainHashes` Set. The extension is additive: if either the email hash or the domain hash matches, `isEmailApproved` returns `true`. The `evaluateGuestCheckMode` function and all five guest-check modes require zero changes — they receive the same `boolean` result and are unaware of how it was computed.

The API routes mirror `src/app/api/allowlists/[id]/entries/route.ts` almost exactly. Key differences: domain validation replaces email validation; `TIER_LIMITS[tier].domainEntries` replaces `.allowlistEntries`; `ADD_DOMAIN`/`REMOVE_DOMAIN` AuditAction values replace `ADD`/`REMOVE`; `prisma.domainEntry` replaces `prisma.allowlistEntry`.

**Primary recommendation:** Clone the entries route pair, swap four things (model, action enum values, tier key, validation), then extend `isEmailApproved` to also hash and check the domain extracted from each email. Do not touch `evaluateGuestCheckMode`.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | (project) | API route handlers | Established project stack |
| Prisma | (project) | ORM — `prisma.domainEntry` model | Already migrated in Phase 15 |
| Zod | (project) | Domain validation schema + `safeParse` | Consistent with all existing routes |
| Node `crypto` | built-in | SHA-256 hash + `timingSafeEqual` | Existing webhook security pattern |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostHog server | (project) | Event tracking for domain add/remove | Same fire-and-forget pattern as entries route |
| `@/lib/session` `getCurrentUser` | (project) | Auth check | Every API route |
| `@/lib/utils` `TIER_LIMITS` | (project) | Tier limit enforcement | Domain entry count check |

### No new dependencies

This phase adds zero new packages. All required libraries are already installed.

---

## Architecture Patterns

### New File Structure

```
src/app/api/allowlists/[id]/
├── entries/
│   ├── route.ts              # exists — reference implementation
│   └── [entryId]/route.ts    # exists — reference implementation
└── domains/                  # NEW — create this folder
    ├── route.ts              # NEW — POST (add domains), GET optional
    └── [domainId]/
        └── route.ts          # NEW — DELETE domain entry
```

### Pattern 1: Domain POST route (mirrors entries POST)

The entries POST route structure is the exact template. Mapping:

| Entries route | Domains route |
|---------------|---------------|
| `addEntriesSchema` with `emails` array | `addDomainsSchema` with `domains` array |
| `isValidEmail(normalizedEmail)` | Zod domain validation inline |
| `TIER_LIMITS[tier].allowlistEntries` | `TIER_LIMITS[tier].domainEntries` |
| `prisma.allowlistEntry.findFirst` | `prisma.domainEntry.findFirst` |
| `prisma.auditLog.create({ action: 'ADD' })` | `prisma.auditLog.create({ action: 'ADD_DOMAIN' })` |
| `prisma.allowlistEntry.create` | `prisma.domainEntry.create` |
| PostHog `add_email` | PostHog `add_domain` (discretion) |

**AuditLog `targetEmail` field for domain entries:** The `AuditLog` model uses `targetEmail String @db.VarChar(255)`. For domain operations, store the domain string (e.g., `company.com`) in this field — it is semantically the target of the action, and the field name is not enforced by a constraint.

**Duplicate check:** Use `@@unique([allowlistId, domain])` constraint — query with `prisma.domainEntry.findFirst({ where: { allowlistId, domain: normalizedDomain } })`.

### Pattern 2: Domain DELETE route (mirrors entryId DELETE)

Direct mirror of `src/app/api/allowlists/[id]/entries/[entryId]/route.ts` DELETE handler:

1. Auth check
2. Ownership check (`prisma.allowlist.findFirst`)
3. Find domain entry by `[domainId]` param
4. Write audit log FIRST (`ADD_DOMAIN` → `REMOVE_DOMAIN`)
5. Delete domain entry

### Pattern 3: Webhook handler extension

The webhook handler contains one closure and one Prisma include block that need changes.

**Current include block (lines 144-158):**
```typescript
// Source: src/app/api/webhooks/calendly/route.ts
include: {
  allowlists: {
    where: { isGlobal: true },
    include: {
      entries: {
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      },
    },
  },
},
```

**Extended include block (add domainEntries):**
```typescript
// Source: src/app/api/webhooks/calendly/route.ts — extended
include: {
  allowlists: {
    where: { isGlobal: true },
    include: {
      entries: {
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      },
      domainEntries: true,  // DomainEntry has no expiry field
    },
  },
},
```

**Current `isEmailApproved` closure (lines 171-190):**
```typescript
// Source: src/app/api/webhooks/calendly/route.ts lines 171-190
const allowedEmailHashes = new Set(
  (globalAllowlist?.entries || []).map(e =>
    crypto.createHash('sha256').update(e.email.toLowerCase()).digest('hex')
  )
)

function isEmailApproved(email: string): boolean {
  const candidateHashHex = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
  const candidateHash = Buffer.from(candidateHashHex, 'hex')
  for (const storedHashHex of allowedEmailHashes) {
    const storedHash = Buffer.from(storedHashHex, 'hex')
    try {
      if (crypto.timingSafeEqual(candidateHash, storedHash)) return true
    } catch {
      // Lengths should always match (both SHA-256 = 32 bytes) but handle defensively
    }
  }
  return false
}
```

**Extended closure (add domain hash set and domain check):**
```typescript
// Extended pattern for Phase 16
const allowedEmailHashes = new Set(
  (globalAllowlist?.entries || []).map(e =>
    crypto.createHash('sha256').update(e.email.toLowerCase()).digest('hex')
  )
)

const allowedDomainHashes = new Set(
  (globalAllowlist?.domainEntries || []).map(d =>
    crypto.createHash('sha256').update(d.domain.toLowerCase()).digest('hex')
  )
)

function isHashInSet(candidateHex: string, hashSet: Set<string>): boolean {
  const candidateBuffer = Buffer.from(candidateHex, 'hex')
  for (const storedHashHex of hashSet) {
    const storedBuffer = Buffer.from(storedHashHex, 'hex')
    try {
      if (crypto.timingSafeEqual(candidateBuffer, storedBuffer)) return true
    } catch { /* lengths always match for SHA-256 */ }
  }
  return false
}

function isEmailApproved(email: string): boolean {
  const lowerEmail = email.toLowerCase()
  // Check exact email match
  const emailHashHex = crypto.createHash('sha256').update(lowerEmail).digest('hex')
  if (isHashInSet(emailHashHex, allowedEmailHashes)) return true
  // Check domain match
  const domain = lowerEmail.split('@')[1]
  if (domain) {
    const domainHashHex = crypto.createHash('sha256').update(domain).digest('hex')
    if (isHashInSet(domainHashHex, allowedDomainHashes)) return true
  }
  return false
}
```

Note: The inner loop logic can optionally be refactored into `isHashInSet` helper to avoid code duplication, as shown above. Either approach is correct.

### Pattern 4: Zod domain validation schema

```typescript
// Claude's discretion — recommended Zod schema for domain validation
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
  'aol.com', 'icloud.com', 'protonmail.com', 'live.com',
  'msn.com', 'me.com', 'mac.com',
])

// Valid domain: optional leading @, lowercase after normalization,
// no spaces, has at least one dot, not bare TLD, max 253 chars
const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

const addDomainsSchema = z.object({
  domains: z.array(z.string()).min(1),
})

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

function validateDomain(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeDomain(raw)
  if (!normalized || normalized === '.') {
    return { valid: false, normalized, error: 'Invalid domain format' }
  }
  if (normalized.length > 253) {
    return { valid: false, normalized, error: 'Domain exceeds maximum length of 253 characters' }
  }
  if (!domainRegex.test(normalized)) {
    return { valid: false, normalized, error: `Invalid domain format: "${raw}"` }
  }
  if (FREE_EMAIL_PROVIDERS.has(normalized)) {
    return { valid: false, normalized, error: `"${normalized}" is a free email provider. Domain allowlisting is intended for corporate domains only.` }
  }
  return { valid: true, normalized }
}
```

### Anti-Patterns to Avoid

- **Modifying `evaluateGuestCheckMode`:** This function is unaware of domains. Never add domain logic here — it receives only `boolean` values from `isEmailApproved`. The abstraction is correct.
- **Separate Prisma queries for domains:** D-10 mandates a single query. Add `domainEntries: true` to the existing include block.
- **Wildcard expansion:** D-02 explicitly prohibits it. `mail.company.com` and `company.com` are separate entries with separate lookups.
- **String comparison for domains in webhook:** Must use timing-safe hash comparison (D-09), not `===` string equality.
- **Domain entries with expiry:** `DomainEntry` model has no `expiresAt` field — include all domain entries without a date filter.
- **Mutation before audit log:** Audit log MUST be written before `prisma.domainEntry.create/delete` — same pattern as email entries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing-safe string comparison | Custom equality loop | `crypto.timingSafeEqual` via SHA-256 hash | Prevents timing side-channel attacks; already established in webhook handler |
| Domain format validation | Custom regex written from scratch | Zod schema with tested regex (see Pattern 4) | RFC 1123 compliance edge cases; Zod provides consistent error structure |
| Auth checks | Custom session parsing | `getCurrentUser()` from `@/lib/session` | Consistent auth across all routes |
| Tier enforcement | Custom limit logic | `TIER_LIMITS[user.subscriptionTier].domainEntries` | Already defined in `src/lib/utils.ts` with all four tiers |

**Key insight:** This phase has zero novel problems. Every sub-problem (auth, validation, tier limits, audit logging, hashing) has an established solution in the codebase. The work is adaptation, not invention.

---

## Common Pitfalls

### Pitfall 1: Domain entry Prisma include missing from webhook query
**What goes wrong:** Webhook handler approves domain-matched bookings only sometimes, or never — depending on whether `globalAllowlist?.domainEntries` is `undefined`.
**Why it happens:** Forgetting to add `domainEntries: true` to the Prisma include block while adding the hash set construction.
**How to avoid:** Extend the include block at the same time as adding `allowedDomainHashes`. Verify `domainEntries` is present on the `globalAllowlist` object before building the hash set.
**Warning signs:** `allowedDomainHashes` is always empty; all domain-matched emails fail approval.

### Pitfall 2: Domain extraction from email before `@` normalization
**What goes wrong:** `email.split('@')[1]` called on an already-normalized domain string (no `@`) returns `undefined`, causing silent domain check skip.
**Why it happens:** Applying domain extraction to the wrong variable — domain entries are stored without `@`, but the webhook receives full email addresses like `user@company.com`.
**How to avoid:** Always extract the domain from the full email address: `const domain = inviteeEmail.split('@')[1]`. The stored domain does NOT have `@`.

### Pitfall 3: Forgetting `@` strip in API normalization
**What goes wrong:** A user submits `@company.com` and it is stored as `@company.com`. Later, the webhook extracts `company.com` from an email and the hash comparison fails.
**Why it happens:** Normalization strip (`replace(/^@/, '')`) omitted from POST route processing.
**How to avoid:** Always apply `normalizeDomain` (or equivalent) before storing. Test the POST route with both `@company.com` and `company.com` inputs.

### Pitfall 4: Free email provider check applied after normalization only
**What goes wrong:** A user submits `@Gmail.com` — normalization lowercases it to `gmail.com` before the free provider check — this is correct. But if normalization happens AFTER the free-provider check, `@Gmail.com` passes through.
**How to avoid:** Always normalize FIRST, then validate (including free provider check). Validation operates on the normalized value.

### Pitfall 5: Tier limit count query targets wrong model
**What goes wrong:** Tier limit check uses `allowlist._count.entries` (email entries count) instead of domain entries count, allowing unlimited domain entries.
**Why it happens:** Copy-paste from entries route without updating the count query.
**How to avoid:** In POST route, include `_count: { select: { domainEntries: true } }` in the allowlist include, then check `allowlist._count.domainEntries` against `TIER_LIMITS[tier].domainEntries`.

### Pitfall 6: `evaluateGuestCheckMode` receives wrong inputs after webhook refactor
**What goes wrong:** Guest-check modes behave incorrectly (e.g., STRICT mode approves when it shouldn't).
**Why it happens:** `approvedGuests` and `unapprovedGuests` arrays are built using the OLD `isEmailApproved` before the domain extension, then `isEmailApproved` is replaced — the arrays don't reflect domain matches.
**How to avoid:** Build `approvedGuests`/`unapprovedGuests` AFTER the extended `isEmailApproved` function is defined. In the existing code this is already correct (closure defined before usage), but confirm the order is maintained.

---

## Code Examples

### Webhook include block extension
```typescript
// Source: src/app/api/webhooks/calendly/route.ts — extend existing include
allowlists: {
  where: { isGlobal: true },
  include: {
    entries: {
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    },
    domainEntries: true,  // add this — no expiry filter needed
  },
},
```

### Domain entry count for tier check
```typescript
// In POST /api/allowlists/[id]/domains route
const allowlist = await prisma.allowlist.findFirst({
  where: { id, userId: user.id },
  include: {
    _count: {
      select: { domainEntries: true },
    },
  },
})

const currentCount = allowlist._count.domainEntries
const tierLimit = TIER_LIMITS[user.subscriptionTier].domainEntries
if (currentCount + validDomains.length > tierLimit) {
  return NextResponse.json({
    error: 'Domain entry limit exceeded',
    message: `Your ${user.subscriptionTier} plan allows ${tierLimit} domain entries. You currently have ${currentCount}.`,
    limit: tierLimit,
    current: currentCount,
  }, { status: 403 })
}
```

### Audit log for domain operations
```typescript
// Matches existing pattern — targetEmail field stores the domain string
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'ADD_DOMAIN',      // or 'REMOVE_DOMAIN'
    targetEmail: normalizedDomain,  // stores "company.com", not an email
    allowlistId: id,
  },
})
```

---

## State of the Art

No new patterns introduced. All approaches are established project patterns.

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| N/A | `crypto.timingSafeEqual` + SHA-256 | Already in use since webhook handler was written |
| String equality for email check | Hash-based timing-safe comparison | Domain check reuses same mechanism |

---

## Open Questions

1. **`isHashInSet` refactor vs inline duplication**
   - What we know: The current `isEmailApproved` closure inlines the hash comparison loop. Adding domain check duplicates that loop.
   - What's unclear: Whether to extract a helper function `isHashInSet` or inline both loops.
   - Recommendation: Extract helper — reduces duplication, easier to test in isolation. Both are correct.

2. **POST route response shape for domains**
   - What we know: Email entries POST returns `{ added, duplicates, invalid, addedEmails }`.
   - What's unclear: Whether domains route should return `{ added, duplicates, invalid, addedDomains }` or a simpler shape.
   - Recommendation: Mirror the entries route shape exactly — `{ added: number, duplicates: string[], invalid: string[], addedDomains: string[] }`. Consistency aids API consumers (future Phase 17 UI).

3. **Behavior when `domain = undefined` after `split('@')[1]`**
   - What we know: If an email has no `@` (malformed), `split('@')[1]` returns `undefined`. This should not happen in practice as Calendly validates invitee emails.
   - Recommendation: Guard with `if (domain)` before hashing — already shown in Pattern 3 code above.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/app/api/allowlists` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOM-04 | Domain POST: valid domain added, audit log written first | unit | `npx vitest run src/app/api/allowlists/\\[id\\]/domains` | ❌ Wave 0 |
| DOM-04 | Domain POST: free provider rejected with 400 | unit | same | ❌ Wave 0 |
| DOM-04 | Domain POST: invalid format (bare @, @.com) rejected | unit | same | ❌ Wave 0 |
| DOM-04 | Domain POST: tier limit enforced with 403 | unit | same | ❌ Wave 0 |
| DOM-04 | Domain POST: duplicate domain skipped | unit | same | ❌ Wave 0 |
| DOM-04 | Domain DELETE: domain removed, audit log written first | unit | same | ❌ Wave 0 |
| DOM-04 | Webhook: invitee email matches domain entry → approved | unit | `npx vitest run src/app/api/webhooks` | ❌ Wave 0 |
| DOM-04 | Webhook: guest email matches domain under STRICT mode → approved | unit | same | ❌ Wave 0 |
| DOM-04 | Webhook: no email/domain match → rejected | unit | same | ❌ Wave 0 |
| DOM-04 | Webhook: ALLOW_ALL mode, domain irrelevant → approved | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/app/api/allowlists/\\[id\\]/domains`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/app/api/allowlists/[id]/domains/domains.test.ts` — covers domain POST and DELETE routes (DOM-04 API surface)
- [ ] `src/app/api/webhooks/calendly/webhook-domain.test.ts` — covers domain hash matching in webhook handler (DOM-04 webhook surface)

**Existing test infrastructure:** `vitest.config.ts` present, `src/test/setup.ts` present. No framework install needed. Pattern reference: `src/app/api/allowlists/allowlists.test.ts` shows the exact mock structure (vi.mock for prisma, session, utils) that domain tests should replicate.

---

## Sources

### Primary (HIGH confidence)

- Direct code read: `src/app/api/allowlists/[id]/entries/route.ts` — reference implementation for POST
- Direct code read: `src/app/api/allowlists/[id]/entries/[entryId]/route.ts` — reference implementation for DELETE
- Direct code read: `src/app/api/webhooks/calendly/route.ts` — `isEmailApproved` closure, include block, lines 144-204
- Direct code read: `src/lib/guest-check.ts` — all 5 guest-check modes, `evaluateGuestCheckMode` signature
- Direct code read: `prisma/schema.prisma` — `DomainEntry` model, `AuditAction` enum with `ADD_DOMAIN`/`REMOVE_DOMAIN`
- Direct code read: `src/lib/utils.ts` — `TIER_LIMITS` with `domainEntries` keys (FREE: 10, PRO: 100, BUSINESS: 500, ENTERPRISE: Infinity)
- Direct code read: `.planning/phases/16-domain-api-webhook/16-CONTEXT.md` — all locked decisions D-01 through D-12

### Secondary (MEDIUM confidence)

- Direct code read: `src/app/api/allowlists/allowlists.test.ts` — Vitest mock patterns for prisma/session/utils used in existing API tests
- Direct code read: `vitest.config.ts` — test include patterns, setup file, environment

### Tertiary (LOW confidence)

None — all findings are from direct code reads of the live project.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from direct code reads; no new packages required
- Architecture patterns: HIGH — all patterns are direct adaptations of existing code in the repository
- Pitfalls: HIGH — derived from reading the actual implementation patterns and identifying deviation risks
- Webhook extension: HIGH — full webhook handler read; extension points clearly identified

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable — no external dependencies; all patterns are internal to the project)

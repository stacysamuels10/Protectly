# Phase 16: Domain API + Webhook - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add CRUD API routes for domain entries and update the webhook handler to check domain entries during booking interception. Requirement DOM-04: webhook booking check matches invitee email against domain entries including guest emails under all 5 check modes.

</domain>

<decisions>
## Implementation Decisions

### Domain validation
- **D-01:** Accept input with or without `@` prefix — normalize to lowercase without `@` on storage (e.g. both `@company.com` and `company.com` → stored as `company.com`)
- **D-02:** Subdomains are accepted as separate entries — `mail.company.com` is valid and distinct from `company.com`. No wildcard expansion.
- **D-03:** Block common free email providers entirely (gmail.com, outlook.com, yahoo.com, hotmail.com, aol.com, icloud.com, protonmail.com, etc.) — server-side reject with clear error message. Adding these would defeat booking protection.
- **D-04:** Invalid formats rejected: bare `@`, `@.com`, domains without a dot, domains with spaces, domains longer than 253 chars. Use Zod schema with regex.

### API route structure
- **D-05:** Domain routes live at `/api/allowlists/[id]/domains/` — parallel to existing `/entries/` path, clean REST separation
- **D-06:** POST accepts array: `{ domains: ["company.com", "partner.org"] }` — consistent with email entries API pattern
- **D-07:** DELETE at `/api/allowlists/[id]/domains/[domainId]` — same pattern as entry deletion
- **D-08:** Follow existing patterns: ownership check, Zod safeParse, tier limit enforcement (`TIER_LIMITS[tier].domainEntries`), audit log written FIRST (action: ADD_DOMAIN/REMOVE_DOMAIN), PostHog event tracking

### Webhook domain matching
- **D-09:** Use timing-safe hash comparison for domains — consistent security posture with email matching. Build a parallel `allowedDomainHashes` Set alongside `allowedEmailHashes`
- **D-10:** Load domain entries in the same Prisma include block as email entries — single query, two hash sets built from results
- **D-11:** For each incoming email: first check email hash set, then extract domain (`email.split('@')[1]`), hash it, check domain hash set. Approved if either matches.
- **D-12:** Domain matching applies to invitee email AND all guest emails — feeds into `evaluateGuestCheckMode` exactly like email matching (the `isEmailApproved` function becomes "is email OR domain approved")

### Claude's Discretion
- Exact Zod regex pattern for domain validation
- List of blocked free email providers (minimum: gmail.com, outlook.com, yahoo.com, hotmail.com, aol.com, icloud.com)
- Error message wording for blocked providers
- PostHog event names for domain add/remove

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow existing allowlist entry CRUD patterns closely.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API patterns
- `src/app/api/allowlists/[id]/entries/route.ts` — Reference implementation for CRUD: Zod validation, ownership check, tier enforcement, audit-first pattern, PostHog tracking
- `src/app/api/allowlists/[id]/entries/[entryId]/route.ts` — DELETE pattern with audit-first

### Webhook handler
- `src/app/api/webhooks/calendly/route.ts` — `isEmailApproved` closure (lines 178-190), `allowedEmailHashes` Set construction, `evaluateGuestCheckMode` call site
- `src/lib/guest-check.ts` — 5 guest-check modes, `GuestCheckResult` interface

### Schema (Phase 15 output)
- `prisma/schema.prisma` — DomainEntry model, AuditAction enum with ADD_DOMAIN/REMOVE_DOMAIN
- `src/lib/utils.ts` — TIER_LIMITS with domainEntries counts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Allowlist entry POST route — nearly identical structure for domain POST (ownership, Zod, tier check, audit, create)
- Allowlist entry DELETE route — same pattern for domain DELETE
- `isEmailApproved` function — extend with domain hash set check
- `verifyWebhookSignature`, `isTimestampValid` — unchanged, webhook security stays intact

### Established Patterns
- Module-level Zod schema + `safeParse()` + structured error `{ error: string, details: ZodError[] }`
- Ownership check: `prisma.allowlist.findFirst({ where: { id, userId: user.id } })`
- Tier limit: `TIER_LIMITS[user.subscriptionTier].domainEntries` vs count + new entries
- Audit log: write FIRST before mutation, include userId, action, targetEmail (stores domain), allowlistId
- SHA-256 hex digest + `Buffer.from(hex, 'hex')` + `crypto.timingSafeEqual` for comparison

### Integration Points
- Prisma include block in webhook handler: add `domainEntries: { where: { ... } }` to the existing allowlist include
- `isEmailApproved` closure: extend to also check `allowedDomainHashes`
- `evaluateGuestCheckMode` receives the same `isApproved` boolean — no changes needed to guest-check module itself

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-domain-api-webhook*
*Context gathered: 2026-03-27*

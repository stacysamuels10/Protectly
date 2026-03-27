# Phase 15: Domain Schema - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add DomainEntry as a separate Prisma model alongside AllowlistEntry. Extend AuditAction enum with domain-specific actions. Add domain entry tier limits. This is a pure infrastructure phase — no API routes, no UI, no webhook changes.

</domain>

<decisions>
## Implementation Decisions

### Schema design
- **D-01:** DomainEntry is a separate Prisma model, NOT a type discriminator on AllowlistEntry — prevents breakage of existing CSV import/export, email validation, timing-safe comparison, and 14+ tests
- **D-02:** DomainEntry fields are minimal: `id`, `allowlistId` (FK to Allowlist), `domain` (stored lowercase without @ prefix, e.g. "company.com"), `createdAt`, `updatedAt`
- **D-03:** No optional fields (notes, expiresAt, addedById) — keep minimal, add later if needed
- **D-04:** Unique constraint on `[allowlistId, domain]` to prevent duplicate domain entries per allowlist
- **D-05:** Index on `domain` for webhook lookup performance

### Tier limits
- **D-06:** Domain entry limits: FREE=10, PRO=100, BUSINESS=500, ENTERPRISE=Infinity
- **D-07:** Domain allowlisting available on FREE tier (10 domains) — let users try the feature, upgrade for more
- **D-08:** Add `domainEntries` key to TIER_LIMITS in lib/utils.ts

### AuditAction enum
- **D-09:** Add ADD_DOMAIN and REMOVE_DOMAIN to the AuditAction enum
- **D-10:** AuditLog.targetEmail column stores domain values as-is (e.g. "company.com") — no column rename needed, the semantic mismatch is acceptable for an append-only log

### Claude's Discretion
- Migration naming convention
- Exact index type (btree default is fine)
- Table name for DomainEntry (suggest `domain_entries`)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard Prisma migration patterns apply.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Existing schema patterns
- `prisma/schema.prisma` — AllowlistEntry model (lines 133-153) is the closest sibling pattern to follow
- `prisma/schema.prisma` — AuditAction enum (lines 186-191) needs extension
- `src/lib/utils.ts` — TIER_LIMITS constant is the single source of truth for tier enforcement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- AllowlistEntry model structure — DomainEntry mirrors this (same allowlistId FK pattern, similar constraints)
- Allowlist model already has `entries AllowlistEntry[]` relation — add parallel `domainEntries DomainEntry[]`

### Established Patterns
- Models use `@map("snake_case_table")` for table names
- All models have `id String @id @default(cuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- AuditLog uses plain string for userId (not FK) — domain audit entries follow same pattern
- TIER_LIMITS is a flat object keyed by SubscriptionTier enum values

### Integration Points
- Allowlist model needs a new `domainEntries DomainEntry[]` relation field
- TIER_LIMITS type will need updating if it's explicitly typed (check if `as const` is sufficient)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-domain-schema*
*Context gathered: 2026-03-26*

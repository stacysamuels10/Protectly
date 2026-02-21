# Pitfalls Research

**Domain:** Security hardening retrofit — Next.js 15 / Prisma / PostgreSQL SaaS (Protectly/PriCal)
**Researched:** 2026-02-20
**Confidence:** HIGH (codebase directly analyzed; findings grounded in specific files and line numbers)

---

## Critical Pitfalls

### Pitfall 1: Encrypting New Tokens Without Migrating Existing Plaintext Tokens

**What goes wrong:**
You add encryption logic to the OAuth callback (for new tokens on login) and the token refresh path, but you skip a migration pass over existing rows. Every user who does not log in during the rollout window continues to have plaintext tokens in `users.calendlyAccessToken` and `users.calendlyRefreshToken`. The schema comment "stored encrypted in production" becomes true only for new logins. The database is never fully hardened.

**Why it happens:**
Developers treat encryption as a code change (add encrypt/decrypt calls) rather than a data migration. The assumption is "users will log in and get new encrypted tokens eventually." In practice, long-lived sessions (iron-session cookie is valid for 7 days; Calendly tokens live much longer) mean most rows remain plaintext indefinitely.

**How to avoid:**
Write a one-time Prisma migration script that reads every `calendlyAccessToken`/`calendlyRefreshToken`, encrypts with `crypto.createCipheriv` using a stable `TOKEN_ENCRYPTION_KEY` env var, and writes back. Run this migration in a transaction before deploying the code that assumes tokens are encrypted. Gate the migration with a `DRY_RUN` flag to verify counts first. After deploying: verify all rows have the `enc:v1:` prefix (or equivalent version marker).

**Warning signs:**
- Encryption code merged to main but no migration script exists alongside it.
- `prisma.user.count()` minus count of rows with encrypted prefix > 0 in staging after deploy.
- Token refresh path reads a raw value and passes it directly to `refreshAccessToken()` without decrypting first — this will cause silent 401 failures for un-migrated rows.

**Phase to address:** Token encryption phase — migration script must be the first artifact produced, not a follow-up.

---

### Pitfall 2: Breaking Token Refresh Because Decryption Is Missing in One Code Path

**What goes wrong:**
Protectly has token refresh in two separate places: `calendlyRequest()` in `src/lib/calendly.ts` (lines 304–319) and `cancelBookingWithRetry()` in `src/app/api/webhooks/calendly/route.ts` (lines 336–350). When encryption is added, developers add decrypt calls in `calendlyRequest()` but forget `cancelBookingWithRetry()`, which reads `user.calendlyRefreshToken` directly from the Prisma result. The refresh attempt sends a ciphertext string as the refresh token, Calendly returns 401, and the retry loop fails silently. Bookings that should be cancelled are not cancelled.

**Why it happens:**
The duplication in the codebase creates two independent code paths that must both be updated. Grep for `calendlyRefreshToken` returns hits in both files, but under time pressure developers fix only the obvious one. The webhook path is a fire-and-forget handler that returns `received: true` even on partial failure, so the bug is invisible in logs.

**How to avoid:**
Consolidate before encrypting. Create a single `TokenStore` service (or extend `calendlyRequest()`) that is the only place allowed to read or write OAuth tokens. All callers receive plaintext tokens after decryption; no caller ever touches raw DB fields. This makes the encrypt/decrypt boundary explicit and untestable gaps impossible. Do not add encryption until this consolidation is complete.

**Warning signs:**
- More than one file imports `calendlyRefreshToken` from a Prisma result.
- `cancelBookingWithRetry` receives a `user` object with raw token fields rather than going through a token manager.
- Token refresh tests pass in isolation but cancellation fails in integration tests.

**Phase to address:** Token encryption phase, as a prerequisite step (consolidation before encryption).

---

### Pitfall 3: Choosing an Encryption Algorithm That Cannot Be Rotated

**What goes wrong:**
Teams reach for `bcrypt` for token encryption because it is familiar from password hashing. `bcrypt` is a one-way hash — you cannot recover the original plaintext to make API calls. Tokens must be reversibly encrypted (AES-256-GCM), not hashed. Using bcrypt produces tokens that can never be decrypted and all users immediately lose Calendly connectivity.

The second rotation pitfall: using a single static encryption key with no version marker in the stored ciphertext. When the key must be rotated (compromise, compliance audit), there is no way to know which rows were encrypted with which key, making rotation a big-bang operation that requires downtime.

**How to avoid:**
Use `crypto.createCipheriv('aes-256-gcm', key, iv)` from Node's built-in `crypto` module. Store ciphertext with a version prefix: `enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`. The version prefix makes key rotation incremental: old rows are re-encrypted on next read (lazy rotation) or via a background job. Keep the encryption key in `TOKEN_ENCRYPTION_KEY` env var (Railway secret, Vercel env secret) — never commit it. Minimum 32-byte key generated with `openssl rand -hex 32`.

**Warning signs:**
- Any suggestion to use `bcrypt`, `argon2`, or `scrypt` for token storage.
- Ciphertext stored without IV or version marker.
- Encryption key hardcoded in the codebase or `.env.local` committed to git.

**Phase to address:** Token encryption phase — algorithm choice must be locked before writing any migration script.

---

### Pitfall 4: Rate Limiting That Does Not Survive Vercel's Serverless Restarts

**What goes wrong:**
Developers add in-memory rate limiting (a `Map<string, number[]>` tracking request timestamps per IP) at the top of a route file. This works locally and in a single-process Node server. On Vercel, each serverless function invocation may be a fresh process. The in-memory counter resets every cold start, making the rate limit ineffective under load. An attacker who triggers cold starts (by spacing requests slightly) can bypass the rate limit entirely.

**Why it happens:**
In-memory state is the path of least resistance. The Vercel deployment model is not front-of-mind during implementation. Rate limiting works in dev, tests pass, the bug only surfaces in production under actual attack conditions.

**How to avoid:**
Use an external counter. The current stack (Railway-hosted PostgreSQL, Vercel-deployed Next.js) has two viable options:

1. **Upstash Redis** — Redis with HTTP API, works from Vercel Edge and serverless. Use `@upstash/ratelimit` with a sliding window. Adds one external service but is the standard Next.js/Vercel solution.
2. **PostgreSQL-backed counter** — Insert a `rate_limit_hits` table with `(identifier, window_start, count)` and use `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`. More latency but zero new services. Acceptable for non-webhook endpoints.

Apply rate limiting at the route level (in each Route Handler) rather than in middleware, because Vercel middleware runs on Edge Runtime, which restricts which Node.js APIs are available. Confirm the chosen library is Edge-compatible before adding it to middleware.

**Warning signs:**
- Rate limit state stored in a module-level variable (`const requestCounts = new Map()`).
- Rate limit tests only run with a single test process (never simulate concurrent processes).
- No Redis or database-backed store referenced in the rate limiting implementation.

**Phase to address:** Rate limiting phase. Check Vercel serverless constraints before implementing.

---

### Pitfall 5: Webhook Signature Verification Made Optional by a Missing Environment Variable

**What goes wrong:**
The current webhook handler (lines 66–77 of `src/app/api/webhooks/calendly/route.ts`) only verifies the signature if `CALENDLY_WEBHOOK_SIGNING_KEY` is set:

```typescript
if (webhookSigningKey) {
  if (!verifyWebhookSignature(...)) { ... }
}
```

If `CALENDLY_WEBHOOK_SIGNING_KEY` is missing from production environment variables — a deployment mistake, a Railway secret rotation gap, or a new environment without secrets configured — all webhooks are accepted without verification. This is a silent security failure: the app continues to function, every booking is processed, but the gate is open to spoofed requests.

**How to avoid:**
Make the signing key required at startup. Add it to the zod environment schema validation (alongside `SESSION_SECRET`). If the key is absent, the application must fail to start (throw during startup, not at request time). Remove the conditional: signature verification is always enforced. The `if (webhookSigningKey)` guard was reasonable during development but must not exist in production code.

**Warning signs:**
- Webhook handler has `if (webhookSigningKey)` or any conditional that skips verification.
- `CALENDLY_WEBHOOK_SIGNING_KEY` is not listed in the required env schema.
- Startup validation (zod `env.ts`) does not include all security-critical keys.

**Phase to address:** Environment validation phase (zod schema) and webhook hardening phase — both must address this.

---

### Pitfall 6: Deleting Legacy Express Files Without Checking for Shared Dependencies or Active Routes

**What goes wrong:**
`app.js` and `server/routes/` are assumed to be dead code, but some of their npm dependencies may still be referenced in the modern Next.js codebase, or the `package.json` `scripts` section may reference `app.js` as an entrypoint. Deleting the files without first auditing imports causes `npm install` failures or runtime `Cannot find module` errors. More dangerously, if Calendly has any active webhook subscriptions pointing at an Express route (pre-migration), deleting those routes drops live events silently.

**Why it happens:**
Legacy code removal feels mechanical — delete the files, done. The dependency audit step is skipped because "it's just old code." The active webhook subscription issue is overlooked because the subscriptions live in Calendly's system, not in the repository.

**How to avoid:**
Before deleting any Express file:
1. Run `grep -r "require.*server\|require.*app\.js\|from.*server\/" src/` to confirm no Next.js code imports from the legacy layer.
2. Check `package.json` scripts for any reference to `app.js`.
3. Query Calendly API (`GET /webhook_subscriptions`) to list all active subscriptions and verify they all point to the Next.js route (`/api/webhooks/calendly`), not any Express URL.
4. Check if `sequelize`, `hbs`, `passport`, `cookie-session`, `express` appear in `dependencies` (not `devDependencies`). They are present in the legacy `app.js` but may only be in `devDependencies` already — verify and remove only after confirming the Next.js app builds without them.

Delete files in this order: `views/` and `models/` first (lowest risk), then `server/routes/`, then `app.js`, then `migrations/` and `seeders/`, then remove orphaned npm packages.

**Warning signs:**
- No grep/audit step before deletion.
- `npm run build` not run after each deletion batch.
- Calendly webhook subscriptions not verified before removing any webhook-related files.

**Phase to address:** Legacy cleanup phase — treat this as a multi-step procedure, not a single commit.

---

### Pitfall 7: Audit Logging That Breaks Existing Writes Due to Transaction Scope Mistakes

**What goes wrong:**
Audit log writes are added inside existing database transactions (or alongside them) without thinking through failure modes. Two common breakages:

1. **Audit write fails, rolls back the business operation.** An allowlist entry is successfully created but the audit log write throws (disk full, schema mismatch, missing column). The whole transaction rolls back, the entry is not created, and the user gets a 500 error. The audit log is now more fragile than the feature it monitors.

2. **Business operation fails, but the audit log is written anyway** (if the audit write is outside the transaction). A partially-completed allowlist bulk import is audited as successful because the audit write happened before the constraint violation.

**Why it happens:**
Audit logging is added as an afterthought — a `prisma.auditLog.create()` call appended to an existing handler without redesigning the transaction boundary. The happy path works; edge cases in error handling are not thought through.

**How to avoid:**
Use `prisma.$transaction([...])` to wrap both the business operation and the audit log write together when the audit entry must be atomically consistent with the business event. For fire-and-forget audit events where failure should not block the business operation (e.g., logging a webhook receipt), write the audit entry in a separate `try/catch` that logs but does not propagate errors. Decide per-event which model applies and be explicit in code comments. Add tests for the failure case: mock the audit log write to throw and assert the business operation still completes (or rolls back) appropriately.

**Warning signs:**
- `prisma.auditLog.create()` appears inside a `$transaction` without explicit rollback behavior documented.
- No tests that simulate audit log write failure.
- Audit log schema added via `prisma db push` in development rather than a named migration (prevents deployment reproducibility).

**Phase to address:** Audit logging phase. Design the failure model before writing any code.

---

### Pitfall 8: Session Secret Fallback Removal Causing Immediate Session Invalidation for All Users

**What goes wrong:**
`src/lib/session.ts` currently uses `process.env.SESSION_SECRET as string` — effectively relying on the env var being set in production while silently using whatever value is provided in dev. If the dev fallback was a hardcoded string (`"randomstringhere"` as seen in the legacy `app.js`), removing it and requiring a real secret is correct. But if the deployed `SESSION_SECRET` value was not set consistently across all Railway/Vercel environments, or was set to something different per environment, changing session configuration invalidates all existing iron-session cookies. Every user is logged out simultaneously.

The same applies to changing `cookieName`: renaming from `"prical_session"` changes the cookie the browser sends, instantly invalidating all sessions even if the secret is unchanged.

**Why it happens:**
The session secret fix is described as "just removing a fallback." The impact on live sessions is not considered. The deployment window for this change is not planned.

**How to avoid:**
Before changing session configuration: confirm `SESSION_SECRET` is already set in all environments (Railway production, Railway staging, Vercel production, any CI environments that run authenticated tests). Verify the value is consistent — not auto-generated per-deploy. Plan for a forced re-login: add a banner to the UI ("Your session has expired — please log in again") or coordinate the rollout during a low-traffic window. Do not rename `cookieName` unless there is a security reason to do so; renaming it invalidates sessions without benefit.

**Warning signs:**
- `SESSION_SECRET` is not listed in Railway/Vercel environment variables before the change is deployed.
- Session secret change is deployed without a plan for user session invalidation.
- `cookieName` is changed at the same time as the secret removal (double invalidation).

**Phase to address:** Session hardening phase — audit environment secrets first, then make the code change.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `if (webhookSigningKey)` guard — skip signature verification if env var missing | App works in dev without key configured | Silent security failure in production if key is not set | Never in production code; only acceptable with startup validation that fails fast |
| In-memory rate limit counters | Zero dependencies, fast to implement | Ineffective on Vercel serverless; bypassed trivially | Never for serverless deployments |
| `process.env.STRIPE_SECRET_KEY!` non-null assertions | No validation boilerplate | Runtime crash with no clear error message; silent `undefined` in some JS contexts | Never when startup validation via zod is available |
| Duplicate token refresh logic in webhook handler and `calendlyRequest()` | Faster initial implementation | Two code paths must both be updated for any security change; bugs guaranteed to be missed in one | Never; consolidate before adding any security layer |
| `prisma migrate dev` for audit log schema in development | Fast schema iteration | Migration file not committed; production deploy breaks | Never; always use named migrations for schema changes |
| Hardcoded `toleranceMs: 180000` (3 minutes) default | Works for initial testing | Wider replay window than necessary; default is now the production behavior unless overridden | Acceptable only with a comment explaining it must be overridden in production |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Calendly webhook verification | Reading `webhookSigningKey` per-request from `process.env` without validating it at startup | Validate `CALENDLY_WEBHOOK_SIGNING_KEY` in zod env schema at startup; treat missing key as fatal |
| Calendly token refresh | Storing the new `refresh_token` from the refresh response in plaintext even after encryption is added | Encrypt new tokens before writing: `encryptToken(newTokens.refresh_token)` — the refresh response always returns new tokens that must also be encrypted |
| Stripe webhook | Not storing `idempotency_key` in BookingAttempt; Stripe fires events multiple times on retry | Store `stripe-signature` header hash or event ID; check before processing to prevent duplicate subscription state mutations |
| iron-session | Changing `password` (SESSION_SECRET) or `cookieName` without planning session invalidation | Plan for all existing sessions being invalidated; communicate to users; use a low-traffic deployment window |
| PostgreSQL via Prisma | Adding an `AuditLog` model with a `NOT NULL` column without a default; running `prisma migrate deploy` on a table with existing rows | Always provide a default value or make the column nullable in the initial migration; test migration against a copy of production data |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Audit log write on every webhook event (synchronous, in-request) | Webhook handler latency increases; Calendly retry storms when handler is slow | Write audit log outside the critical path (after `return NextResponse.json(...)` is not possible — instead, use `waitUntil` on Vercel or write asynchronously with error swallowing) | At ~50 webhook events/minute sustained |
| Rate limit check using PostgreSQL counter table with row-level lock per request | Database connection pool exhausted; `P2024` errors from Prisma under load | Use Redis (Upstash) for rate limit counters; reserve PostgreSQL for business data | At ~100 API requests/minute |
| Audit log table with no index on `userId` + `createdAt` | Audit log queries for dashboard are full table scans | Add `@@index([userId, createdAt(sort: Desc)])` in the Prisma schema when creating the AuditLog model | At ~10,000 audit events |
| `crypto.createCipheriv` encryption called in a database query loop (e.g., encrypting during migration scan) | Migration script hangs; CPU pinned | Batch in chunks of 100 rows; use async iteration; add progress logging | During migration with >1,000 users |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging `calendlyAccessToken` or `calendlyRefreshToken` values in `console.log` statements | Tokens appear in Vercel/Railway log output and may be stored in logging infrastructure | Audit all `console.log` calls in `src/app/api/webhooks/calendly/route.ts` and `src/lib/calendly.ts`; replace any that log user objects with field-whitelisted objects |
| Using `Set.has()` for allowlist email lookup (not constant-time) | Timing oracle: attacker can infer whether an email is on the allowlist by measuring response time | Use `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` for the final email comparison; note that Set construction itself is fine — only the final match must be timing-safe |
| Audit log visible to the user who owns the allowlist but without filtering by userId | A user who guesses audit log IDs can retrieve another user's audit entries | Every audit log query must include `WHERE userId = :currentUserId`; test this with cross-user requests in integration tests |
| Encrypting tokens but not rotating the encryption key when it leaks | Historical token data is retroactively exposed if the key leaks | Document key rotation procedure in runbook; version-prefix ciphertext so rotation can be done row-by-row |
| Rate limiting on allowlist endpoints but not on the webhook endpoint | Webhook endpoint can be spammed to exhaust the 4-second delay pool and cause Calendly retry storms | Apply rate limiting by Calendly Organization URI (from webhook payload) in addition to IP-based limiting on authenticated endpoints |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Token encryption:** Often missing the migration script — verify `SELECT COUNT(*) FROM users WHERE "calendlyAccessToken" NOT LIKE 'enc:v1:%'` returns 0 in production after deploy.
- [ ] **Rate limiting:** Often missing coverage of the webhook endpoint — verify rate limiting tests include `POST /api/webhooks/calendly`, not only authenticated API routes.
- [ ] **Audit logging:** Often missing the failure-mode test — verify a test exists that simulates audit log write failure and asserts the business operation behavior (commit or rollback as designed).
- [ ] **Legacy Express removal:** Often missing orphaned npm package cleanup — verify `npm ls express sequelize hbs passport cookie-session` returns "empty" after file deletion.
- [ ] **Session secret hardening:** Often missing environment variable verification — verify `SESSION_SECRET` is set in Railway production, Railway staging, and all Vercel preview/production environments before deploying the change.
- [ ] **Webhook signature enforcement:** Often missing the "env var absent = fail fast" behavior — verify app startup throws if `CALENDLY_WEBHOOK_SIGNING_KEY` is not set, rather than silently skipping verification.
- [ ] **Timing-safe email comparison:** Often missing the test that detects non-constant-time behavior — verify a test exists using two emails of different lengths that both expect the same response time (within a threshold).

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Plaintext tokens discovered post-encryption-deploy | HIGH | Immediately rotate all Calendly tokens (Calendly allows revocation via API); run encryption migration; notify users of forced re-connection to Calendly |
| In-memory rate limiter bypassed in production attack | MEDIUM | Deploy Redis-backed rate limiter as hotfix; block attacker IPs at Vercel WAF level in the interim; review logs for data exfiltration |
| Legacy Express routes deleted but Calendly webhooks were pointing at them | HIGH | Re-create stub route or restore from git; update Calendly webhook subscription URL via API; audit BookingAttempt table for gap in event coverage |
| Session secret changed without planning — all users logged out | LOW | No data loss; users re-authenticate; add UI banner explaining the logout; monitor support channels |
| Audit log breaks business operation (transaction failure) | MEDIUM | Roll back audit log write to outside-transaction pattern; re-run any failed business operations; audit BookingAttempt table for gaps |
| Wrong encryption algorithm (bcrypt) applied to tokens | HIGH | All users lose Calendly connectivity immediately; must restore from database backup or force re-auth for all users; re-implement with AES-256-GCM |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Encrypting new tokens without migrating existing rows | Token encryption phase | `SELECT COUNT(*) FROM users WHERE "calendlyAccessToken" NOT LIKE 'enc:v1:%'` = 0 |
| Missing decrypt in `cancelBookingWithRetry` | Token encryption phase (consolidation step, before encryption) | Grep confirms `calendlyRefreshToken` is read in only one place |
| Wrong encryption algorithm | Token encryption phase (algorithm review before implementation) | Code review checklist: AES-256-GCM, IV stored with ciphertext, version prefix present |
| In-memory rate limiting on Vercel | Rate limiting phase | Rate limit integration test run against two separate process instances |
| Webhook signature verification skipped | Environment validation phase + webhook hardening phase | Startup test: app refuses to start without `CALENDLY_WEBHOOK_SIGNING_KEY` |
| Legacy Express deletion breaks active routes | Legacy cleanup phase (pre-deletion audit step) | Calendly webhook subscription list checked; `npm run build` passes after each deletion batch |
| Audit log transaction scope mistakes | Audit logging phase (design review before implementation) | Failure-mode test: mock audit write to throw; assert business behavior |
| Session invalidation from secret change | Session hardening phase (env audit before code change) | All environments verified to have consistent `SESSION_SECRET` before deploy |

---

## Sources

- Next.js 15 official authentication documentation — `https://nextjs.org/docs/app/building-your-application/authentication` (fetched 2026-02-20, HIGH confidence)
- Direct codebase analysis of Protectly — `src/lib/session.ts`, `src/lib/calendly.ts`, `src/lib/webhook.ts`, `src/app/api/webhooks/calendly/route.ts`, `src/app/api/auth/calendly/callback/route.ts`, `prisma/schema.prisma`, `app.js` (analyzed 2026-02-20, HIGH confidence)
- `.planning/codebase/CONCERNS.md` — codebase audit performed 2026-02-20, HIGH confidence
- iron-session v8 documentation (known behavior: `password` change invalidates all existing cookies, HIGH confidence from library design)
- Vercel serverless function model (stateless per invocation, HIGH confidence from Vercel architecture documentation)
- Node.js `crypto` module — AES-256-GCM is the standard symmetric encryption primitive for reversible token storage (HIGH confidence, Node.js built-in)

---
*Pitfalls research for: Next.js SaaS security hardening retrofit (Protectly)*
*Researched: 2026-02-20*

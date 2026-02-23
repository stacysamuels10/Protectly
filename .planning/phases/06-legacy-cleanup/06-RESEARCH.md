# Phase 6: Legacy Cleanup - Research

**Researched:** 2026-02-22
**Domain:** Legacy code removal, dependency cleanup, HTTP client consolidation
**Confidence:** HIGH

## Summary

Phase 6 is a deletion-and-consolidation phase. The Protectly codebase was migrated from an Express+Sequelize application to Next.js 15+Prisma, but the old Express application files, Sequelize ORM artifacts, and redundant HTTP client packages were never removed. All legacy files are still tracked in git (added before `.gitignore` entries) even though `.gitignore` already lists them under "Old project files (can be removed after migration)".

The active Next.js application in `src/` has zero imports or references to any legacy file. The only production code change required is migrating `src/lib/calendly.ts` from `axios` to native `fetch` (7 call sites), plus updating 2 test files that mock `axios`. After that, both `axios` and `node-fetch` can be removed from `package.json`.

**Primary recommendation:** Delete all legacy files via `git rm`, migrate `calendly.ts` from axios to native fetch, remove `axios` and `node-fetch` from package.json, verify with `next build` and `vitest run`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLN-01 | Legacy Express application removed (app.js, server/, views/, models/) | 15 files tracked in git confirmed. Zero imports from `src/`. Safe to `git rm` all of them. See "Inventory of Files to Delete" section. |
| CLN-02 | Deprecated Sequelize artifacts removed (migrations/, seeders/, .sequelizerc, config/config.js) | 5 files tracked in git confirmed. No Sequelize references in `src/` or `package.json`. `config/` directory contains only `config.js` so the entire directory can be removed. |
| CLN-03 | Unused HTTP client library removed and codebase standardized on a single HTTP client | `axios` is used only in `src/lib/calendly.ts` (7 call sites) + 2 test files. `node-fetch` is a devDependency with zero imports anywhere. Frontend components already use native `fetch`. Migrate calendly.ts to native fetch, then remove both packages. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch` | Built-in (Node 18+, Next.js 15) | HTTP client for server-side API calls | Next.js extends native fetch with caching/revalidation; no extra dependency needed |
| Next.js | ^15.1.3 | Application framework (already in use) | Provides built-in fetch with enhanced features |
| Vitest | ^4.0.16 | Test runner (already in use) | Already used for all 86 existing tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `git rm` | N/A | Remove tracked files from git index AND filesystem | Required because legacy files were committed before .gitignore entries were added |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | Keep axios | Axios adds unnecessary dependency; Next.js fetch has caching benefits; client components already use fetch |
| Native fetch | ky or got | Additional dependency not justified for 7 simple call sites |

**Installation:**
```bash
# No packages to install - only removals
npm uninstall axios
npm uninstall node-fetch
```

## Architecture Patterns

### Pattern 1: Axios-to-Fetch Migration

**What:** Replace `axios.get/post/delete` calls with native `fetch` + JSON parsing
**When to use:** Each of the 7 call sites in `src/lib/calendly.ts`

**Key differences from axios:**
1. `fetch` does not throw on HTTP error status codes (4xx, 5xx) - must check `response.ok` manually
2. `fetch` does not auto-parse JSON - must call `response.json()` explicitly
3. `fetch` request body must be `JSON.stringify()`'d manually with `Content-Type` header
4. `fetch` returns response with `.status` directly (not `.response.status` on error)

**Critical: Error shape changes.** Current code checks `error.response?.status === 401` (axios error shape). After migration, errors must carry the status in a compatible way. Recommend a small helper or custom error class.

**Example (axios POST to fetch POST):**
```typescript
// BEFORE (axios):
const response = await axios.post(`${URL}/oauth/token`, {
  grant_type: "refresh_token",
  refresh_token: refreshToken,
  client_id: env.CALENDLY_CLIENT_ID,
  client_secret: env.CALENDLY_CLIENT_SECRET,
});
return response.data as { access_token: string; ... };

// AFTER (native fetch):
const response = await fetch(`${URL}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.CALENDLY_CLIENT_ID,
    client_secret: env.CALENDLY_CLIENT_SECRET,
  }),
});
if (!response.ok) {
  const error = new Error(`HTTP ${response.status}`) as any;
  error.response = { status: response.status };
  throw error;
}
return await response.json() as { access_token: string; ... };
```

**Example (axios GET to fetch GET):**
```typescript
// BEFORE (axios):
const response = await axios.get(`${URL}/users/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
return response.data.resource as CalendlyUser;

// AFTER (native fetch):
const response = await fetch(`${URL}/users/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!response.ok) {
  const error = new Error(`HTTP ${response.status}`) as any;
  error.response = { status: response.status };
  throw error;
}
const data = await response.json();
return data.resource as CalendlyUser;
```

**Example (axios DELETE to fetch DELETE):**
```typescript
// BEFORE (axios):
await axios.delete(webhookUri, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

// AFTER (native fetch):
const response = await fetch(webhookUri, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!response.ok) {
  const error = new Error(`HTTP ${response.status}`) as any;
  error.response = { status: response.status };
  throw error;
}
```

### Pattern 2: Error Shape Preservation

**What:** The 401-retry logic in `calendlyRequest` and `cancelBookingWithRetry` checks `error.response?.status === 401`. After removing axios, thrown errors must still expose `.response.status`.

**Recommended approach:** Create a small `HttpError` class or inline error augmentation that preserves the `error.response.status` shape, maintaining backward compatibility with the retry logic.

```typescript
class HttpError extends Error {
  response: { status: number; data?: unknown };
  constructor(status: number, message?: string, data?: unknown) {
    super(message || `HTTP error ${status}`);
    this.response = { status, data };
  }
}
```

### Pattern 3: Safe Git Removal of Tracked-but-Ignored Files

**What:** Files that are both tracked AND in `.gitignore` require `git rm` (not just filesystem delete)
**Why:** These files were committed before the `.gitignore` entries were added. `git status` won't show them as changes unless explicitly removed with `git rm`.

```bash
git rm app.js .sequelizerc config/config.js
git rm -r server/ views/ models/ migrations/ seeders/
```

### Anti-Patterns to Avoid
- **Deleting files with `rm` instead of `git rm`:** Files would remain in the git index and continue to be tracked. Must use `git rm` to remove from both working tree and index.
- **Leaving .gitignore entries for deleted directories:** After `git rm`, the `.gitignore` entries for `/server/`, `/models/`, etc. become dead rules. Clean them up for hygiene.
- **Converting axios calls 1:1 without error handling:** Native `fetch` does NOT throw on 4xx/5xx. Forgetting `response.ok` checks will silently swallow HTTP errors.
- **Removing axios before updating test mocks:** Tests that `vi.spyOn(axios.default, 'post')` will break. Tests must be updated in the same plan as the migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client | Custom fetch wrapper with interceptors | Simple inline error-throwing fetch calls | 7 call sites don't justify a wrapper; YAGNI |
| Error normalization | Complex error middleware | Small `HttpError` class or inline augmentation | Only need `response.status` preserved for 401 retry |

**Key insight:** This phase is about deletion, not creation. Resist the urge to build abstractions. The goal is fewer files, fewer dependencies, simpler code.

## Common Pitfalls

### Pitfall 1: Fetch Does Not Throw on HTTP Errors
**What goes wrong:** Replacing `axios.post(...)` with `fetch(...)` without checking `response.ok` means 401/403/500 responses are silently treated as successes.
**Why it happens:** Axios throws automatically on non-2xx; fetch only throws on network failures.
**How to avoid:** Every `fetch` call must check `response.ok` and throw an error with `.response.status` for the retry logic.
**Warning signs:** Tests pass but webhook cancellation silently fails in production.

### Pitfall 2: Forgetting to JSON.stringify the Request Body
**What goes wrong:** Passing a plain object as `body` to fetch sends `[object Object]`.
**Why it happens:** Axios auto-serializes objects to JSON; fetch does not.
**How to avoid:** Always use `body: JSON.stringify(data)` and set `Content-Type: application/json`.
**Warning signs:** Calendly API returns 400 Bad Request.

### Pitfall 3: Git rm vs Filesystem Delete
**What goes wrong:** Using `rm -rf server/` instead of `git rm -r server/` leaves the files in git's index.
**Why it happens:** Developer instinct is to use shell `rm`, forgetting that git tracks files independently.
**How to avoid:** Always use `git rm` for tracked files. Verify with `git status` after deletion.
**Warning signs:** `git status` shows nothing changed; `git ls-files server/` still returns files.

### Pitfall 4: Breaking Test Mocks During Axios Removal
**What goes wrong:** Removing axios breaks tests that spy on `axios.default.post`.
**Why it happens:** Two test files (`calendly.test.ts`, `route.test.ts`) mock axios directly.
**How to avoid:** Update test mocks to use `vi.fn()` / `globalThis.fetch` mocking (or mock the calendly functions at module level) in the same change as the production code migration.
**Warning signs:** `vitest run` fails with "Cannot find module 'axios'" or spy target errors.

### Pitfall 5: Forgetting to Update package-lock.json
**What goes wrong:** Removing packages from `package.json` but not running `npm install` to regenerate `package-lock.json`.
**Why it happens:** Manual package.json edits skip the lockfile update.
**How to avoid:** Use `npm uninstall axios` and `npm uninstall node-fetch` which update both files atomically.
**Warning signs:** CI fails with lockfile mismatch.

### Pitfall 6: The config/ Directory Becomes Empty
**What goes wrong:** Deleting `config/config.js` leaves an empty `config/` directory.
**Why it happens:** `git rm config/config.js` removes the file but git doesn't track empty directories.
**How to avoid:** After `git rm config/config.js`, the directory will be automatically removed by git (git doesn't track empty dirs). But verify the filesystem directory is also gone. If not, `rmdir config/` manually.
**Warning signs:** Empty `config/` directory lingers on disk.

## Inventory of Files to Delete

### CLN-01: Legacy Express Application (15 files)

Files confirmed tracked via `git ls-files`:

```
app.js                                   # Express entry point (6KB)
server/routes/ApprovedList/app.js        # Express approved list routes
server/routes/Webhooks/index.js          # Express webhook routes
server/routes/Webhooks/verifyWebhook.js  # Express webhook verification
models/index.js                          # Sequelize model loader
models/approvedlist.js                   # Sequelize ApprovedList model
models/userstable.js                     # Sequelize UsersTable model
views/error.hbs                          # Handlebars error template
views/index.hbs                          # Handlebars index template (empty)
```

### CLN-02: Sequelize Artifacts (5 files)

```
.sequelizerc                                    # Sequelize config path resolver
config/config.js                                # Sequelize DB connection config
migrations/20220908211246-create-users-table.js  # Sequelize migration
migrations/20220912155446-approvedlist.js        # Sequelize migration
seeders/20220909130248-UsersTables.js            # Sequelize seeder
seeders/20220912160435-approvedlists.js          # Sequelize seeder
```

### CLN-03: HTTP Client Cleanup

**Packages to remove from package.json:**
- `axios` (dependencies) - used only in `src/lib/calendly.ts` (7 call sites)
- `node-fetch` (devDependencies) - zero imports in entire codebase

**Files to modify:**
- `src/lib/calendly.ts` - migrate 7 axios calls to native fetch
- `src/lib/calendly.test.ts` - update 3 test cases that mock `axios.default.post`
- `src/app/api/webhooks/calendly/route.test.ts` - update error shape creation (uses `Object.assign(new Error(...), { response: { status: 401 } })` which remains compatible)

### Bonus: .gitignore Cleanup

After deletion, these `.gitignore` entries become dead rules and should be removed for hygiene:
```
/server/
/models/
/migrations/
/seeders/
/config/
/views/
app.js
```

Note: `/components/`, `/actions/`, `/reducers/`, `buildscript.js`, `Procfile.dev`, `/public/App.js`, `/public/App.css` are also tracked legacy files mentioned in `.gitignore` but are NOT in scope for CLN-01/02/03. They could be cleaned up as a bonus but the phase requirements don't mandate it.

## Dependency Impact Analysis

### Packages ONLY used by legacy Express code (NOT in package.json)

None of the Express-era packages (`express`, `passport`, `passport-oauth2`, `cookie-session`, `cookie-parser`, `hbs`, `http-errors`, `sequelize`, `dotenv`, `@mui/icons-material`) are listed in the current `package.json`. They were already removed from dependencies during the Next.js migration. Only the source files remain.

### Packages to remove from current package.json

| Package | Location | Used By | Safe to Remove |
|---------|----------|---------|----------------|
| `axios` ^1.6.3 | dependencies | `src/lib/calendly.ts` (7 call sites) | YES, after migrating to fetch |
| `node-fetch` ^3.3.2 | devDependencies | Nothing (zero imports) | YES, immediately |

### Axios Call Sites in calendly.ts (all 7)

1. `exchangeCodeForTokens()` - `axios.post` (OAuth token exchange)
2. `refreshAccessToken()` - `axios.post` (OAuth token refresh)
3. `getCalendlyUser()` - `axios.get` (get user profile)
4. `getEventTypes()` - `axios.get` with params (list event types)
5. `createWebhookSubscription()` - `axios.post` (create webhook)
6. `deleteWebhookSubscription()` - `axios.delete` (delete webhook)
7. `cancelCalendlyEvent()` - `axios.post` (cancel event)

### Test Files Requiring Updates

1. **`src/lib/calendly.test.ts`** - 3 tests spy on `axios.default.post`:
   - "uses decrypted refresh token on 401" - spies on `axiosMock.default.post`
   - "propagates error gracefully when refreshAccessToken throws" - spies on `axiosMock.default.post`
   - "retry after 401 refresh uses the NEW access token" - spies on `axiosMock.default.post`

2. **`src/app/api/webhooks/calendly/route.test.ts`** - Does NOT directly mock axios. It mocks `@/lib/calendly` at module level. Error objects use `Object.assign(new Error(...), { response: { status: 401 } })` which is compatible with both axios and custom error shapes. Minimal changes needed.

## Verification Strategy

### After File Deletion (CLN-01 + CLN-02)

```bash
# Verify files are removed from git index
git ls-files app.js server/ views/ models/ .sequelizerc config/config.js migrations/ seeders/
# Expected: empty output

# Verify files are removed from filesystem
ls app.js server/ views/ models/ .sequelizerc config/config.js migrations/ seeders/ 2>&1
# Expected: all "No such file or directory"
```

### After HTTP Client Migration (CLN-03)

```bash
# Verify no axios/node-fetch in package.json
grep -E '"axios"|"node-fetch"' package.json
# Expected: empty output

# Verify exactly one HTTP client approach (native fetch)
grep -r "import.*from.*axios" src/ --include="*.ts" --include="*.tsx"
# Expected: empty output

grep -r "require.*axios" src/ --include="*.ts" --include="*.tsx"
# Expected: empty output
```

### Final Verification

```bash
# All tests pass
npx vitest run
# Expected: 86 tests passed (count may change slightly if test structure changes)

# Build succeeds
npx next build
# Expected: exit code 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| axios for HTTP | Native fetch (Node 18+) | Node 18 (2022), mature in 2024+ | No dependency needed; Next.js extends fetch with caching |
| node-fetch polyfill | Native fetch | Node 18+ has built-in fetch | node-fetch unnecessary in Node 18+ environments |
| Sequelize ORM | Prisma ORM | Already migrated in this project | Sequelize files are dead code |
| Express server | Next.js App Router | Already migrated in this project | Express files are dead code |

**Deprecated/outdated:**
- `node-fetch`: Unnecessary in Node 18+ (project uses Node 20 per CI config)
- `axios`: Still maintained but unnecessary when native fetch suffices; adds 440KB to node_modules

## Open Questions

1. **Should the other legacy tracked files be cleaned up too?**
   - What we know: `components/`, `actions/`, `reducers/`, `buildscript.js`, `Procfile.dev`, `public/App.js`, `public/App.css` are also tracked legacy files
   - What's unclear: Whether the phase scope should include these (they're not in CLN-01/02/03)
   - Recommendation: Include them as a bonus task in the plan. They're dead code and trivial to `git rm`. But mark as optional since requirements don't mandate it.

2. **Should fetch call caching be disabled for Calendly API calls?**
   - What we know: Next.js extends `fetch` with automatic caching in server components. API route handlers don't cache by default but the behavior depends on context.
   - What's unclear: Whether any Calendly API call could be inadvertently cached
   - Recommendation: Add `{ cache: 'no-store' }` to all Calendly fetch calls as a safety measure, since these are OAuth/mutation operations that should never be cached.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `git ls-files`, file reads, grep across all source files
- `package.json` dependency analysis
- `.gitignore` analysis confirming legacy file awareness
- `vitest run` confirming 86 tests pass (baseline)

### Secondary (MEDIUM confidence)
- Next.js native fetch behavior based on Next.js 15 documentation (fetch caching in App Router)
- Node.js 18+ native fetch availability (project uses Node 20 per CI config `NODE_VERSION: '20'`)

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct codebase inspection, no external library research needed
- Architecture: HIGH - migration patterns are well-understood (axios-to-fetch is thoroughly documented)
- Pitfalls: HIGH - identified from direct code analysis of error handling patterns and test mock structures
- File inventory: HIGH - confirmed via `git ls-files` and filesystem inspection

**Research date:** 2026-02-22
**Valid until:** No expiration - findings are based on static codebase analysis, not library versions

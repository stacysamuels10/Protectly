# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**Calendly - Booking Schedule Management:**
- Service: Calendly API for OAuth, event data, and webhook subscriptions
- What it's used for: User authentication, fetching event types, subscribing to booking events, canceling events
- SDK/Client: axios + custom wrapper functions in `src/lib/calendly.ts`
- Auth: OAuth 2.0 with access token and refresh token
- Env vars:
  - `CALENDLY_CLIENT_ID` - OAuth application client ID
  - `CALENDLY_CLIENT_SECRET` - OAuth application client secret (never expose)
  - `CALENDLY_REDIRECT_URI` - OAuth callback URL (e.g., http://localhost:3000/api/auth/calendly/callback)
  - `CALENDLY_WEBHOOK_SIGNING_KEY` - Key for verifying webhook signatures
  - `WEBHOOK_URL` - URL where Calendly sends webhooks (e.g., http://localhost:3000/api/webhooks/calendly)

**Stripe - Payment Processing:**
- Service: Stripe API for subscription checkout, billing portal, and invoice management
- What it's used for: Creating checkout sessions, managing customer subscriptions, handling billing portal, processing webhooks
- SDK/Client: stripe v14.11.0 (server-side) and @stripe/stripe-js v2.2.2 (client-side)
- Auth: API key-based authentication
- Env vars:
  - `STRIPE_SECRET_KEY` - Server-side secret key (never expose)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side public key (safe to expose)
  - `STRIPE_WEBHOOK_SECRET` - Key for verifying webhook signatures
  - `STRIPE_PRICE_PRO_MONTHLY` - Stripe price ID for monthly Pro tier
  - `STRIPE_PRICE_PRO_YEARLY` - Stripe price ID for yearly Pro tier
  - `STRIPE_PRICE_BUSINESS_MONTHLY` - Stripe price ID for monthly Business tier
  - `STRIPE_PRICE_BUSINESS_YEARLY` - Stripe price ID for yearly Business tier

**GitHub API - Issue & Sprint Management:**
- Service: GitHub REST API for issue and sprint creation
- What it's used for: Creating issues and sprints (used in build scripts)
- SDK/Client: @octokit/rest v22.0.1
- Auth: GitHub token-based authentication
- Usage: `create-issues.sh` and `create-sprints.sh` scripts

**OpenAI API - AI/LLM Services:**
- Service: OpenAI API
- What it's used for: Not actively used in current codebase (package installed but no integration visible)
- SDK/Client: openai v6.16.0
- Auth: API key-based authentication

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: Via `DATABASE_URL` environment variable
  - Client/ORM: Prisma 5.7.1
  - Schema location: `src/prisma/schema.prisma`
  - Models: User, EventType, Allowlist, AllowlistEntry, BookingAttempt
  - Deployment targets: Neon (serverless PostgreSQL) or Railway

**File Storage:**
- CloudFront CDN for image serving
  - Configured in `next.config.js` for image optimization
  - Remote pattern: `https://d3v0px0pttie1i.cloudfront.net/uploads/**`
  - Used for user avatars and other assets

**Caching:**
- None detected - Tailwind CSS, bundle caching handled by Next.js

## Authentication & Identity

**Auth Provider:**
- Calendly OAuth 2.0 (primary) - Single sign-on via Calendly
- Custom session-based (secondary) - iron-session for session management

**Implementation Approach:**
- OAuth Flow:
  1. User initiates login at `/api/auth/calendly`
  2. Redirects to Calendly authorization endpoint
  3. Calendly redirects back to `/api/auth/calendly/callback` with authorization code
  4. Code exchanged for access/refresh tokens via `exchangeCodeForTokens()`
  5. User info fetched via `getCalendlyUser()`
  6. User created/updated in database
  7. Session established via iron-session
- Session Management:
  - Iron-session with encrypted cookies
  - Cookie name: `prical_session`
  - Max age: 7 days
  - Secure flag: true in production, false in development
  - HttpOnly: true (prevents JavaScript access)
  - SameSite: lax (CSRF protection)

**Session Data Structure** (`src/lib/session.ts`):
```typescript
interface SessionData {
  userId?: string
  isLoggedIn: boolean
}
```

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Console logging throughout API routes and lib functions
- Log patterns in:
  - `src/app/api/auth/calendly/callback/route.ts` - OAuth flow logging
  - `src/app/api/webhooks/calendly/route.ts` - Booking event processing
  - `src/app/api/webhooks/stripe/route.ts` - Payment event processing
  - `src/lib/calendly.ts` - API request logging
- Structured logging with labeled prefixes: `[Calendly OAuth]`, `[Calendly Webhook]`, etc.

## CI/CD & Deployment

**Hosting:**
- Primary: Vercel (via vercel.json)
- Fallback: Railway (via railway.json)

**Vercel Configuration:**
- Framework: Next.js
- Build command: `prisma generate && next build`
- Install command: `npm install`
- Regions: iad1 (US East)
- API function timeout: 30 seconds max (defined per function in vercel.json)

**Railway Configuration:**
- Builder: NIXPACKS
- Build command: `npm install --legacy-peer-deps && npx prisma generate && npx prisma db push && npm run build`
- Deploy start command: `npm run start`
- Restart policy: ON_FAILURE with max 10 retries

**CI Pipeline:**
- Not detected - No GitHub Actions, Circle CI, or similar workflow files visible

## Environment Configuration

**Required Environment Variables:**

**Database:**
- `DATABASE_URL` - PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/prical?sslmode=require)

**Calendly Integration:**
- `CALENDLY_CLIENT_ID` - OAuth client ID
- `CALENDLY_CLIENT_SECRET` - OAuth client secret
- `CALENDLY_REDIRECT_URI` - OAuth callback URL
- `CALENDLY_WEBHOOK_SIGNING_KEY` - Webhook signature verification key

**Stripe Integration:**
- `STRIPE_SECRET_KEY` - Server-side API key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side API key (public)
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification key
- `STRIPE_PRICE_PRO_MONTHLY` - Price ID for Pro monthly
- `STRIPE_PRICE_PRO_YEARLY` - Price ID for Pro yearly
- `STRIPE_PRICE_BUSINESS_MONTHLY` - Price ID for Business monthly
- `STRIPE_PRICE_BUSINESS_YEARLY` - Price ID for Business yearly

**Application URLs:**
- `NEXT_PUBLIC_APP_URL` - Public URL of application (default: http://localhost:3000)
- `WEBHOOK_URL` - Webhook callback URL for Calendly (default: {NEXT_PUBLIC_APP_URL}/api/webhooks/calendly)

**Session Security:**
- `SESSION_SECRET` - Encryption key for iron-session (minimum 32 characters, use `openssl rand -hex 32`)

**Environment:**
- `NODE_ENV` - Set to "development" or "production"

**Secrets Location:**
- `.env.local` file (not committed to git)
- Example provided in `env.example` (safe to commit)

## Webhooks & Callbacks

**Incoming Webhooks:**

**Calendly Webhooks:**
- Endpoint: `POST /api/webhooks/calendly` (`src/app/api/webhooks/calendly/route.ts`)
- Events subscribed: `invitee.created`
- Signature verification: Custom HMAC-SHA256 verification in `src/lib/webhook.ts`
- Payload structure: Defined in `CalendlyWebhookPayload` interface in `src/lib/calendly.ts`
- Processing:
  - Verifies webhook signature against `CALENDLY_WEBHOOK_SIGNING_KEY`
  - Checks timestamp validity (3-minute tolerance window)
  - Evaluates invitee/guest emails against allowlist
  - Automatically cancels unauthorized bookings with custom message
  - Logs booking attempt (approved or rejected) to database
  - Applies guest check mode rules (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL)

**Stripe Webhooks:**
- Endpoint: `POST /api/webhooks/stripe` (`src/app/api/webhooks/stripe/route.ts`)
- Events processed:
  - `checkout.session.completed` - New subscription activated
  - `customer.subscription.updated` - Subscription plan or status changed
  - `customer.subscription.deleted` - Subscription cancelled
  - `invoice.payment_failed` - Payment failed
- Signature verification: Built-in Stripe SDK verification using `STRIPE_WEBHOOK_SECRET`
- Processing:
  - Updates user subscription tier and status in database
  - Handles subscription tier transitions (FREE ↔ PRO ↔ BUSINESS)
  - Tracks subscription lifecycle (ACTIVE, TRIALING, PAST_DUE, CANCELED, UNPAID)

**Outgoing Webhooks/Callbacks:**

**Calendly OAuth Callback:**
- Endpoint: `GET /api/auth/calendly/callback` (`src/app/api/auth/calendly/callback/route.ts`)
- Purpose: OAuth authorization code exchange
- Called by: Calendly after user grants permission
- Parameters: `code` (authorization code) and optional `error` (error code)

**Stripe Callback URLs:**
- Success URL: Configured per checkout session in `src/app/api/billing/checkout/route.ts`
- Default: `{NEXT_PUBLIC_APP_URL}/dashboard/settings?success=true`
- Cancel URL: Configured per checkout session
- Default: `{NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`

---

*Integration audit: 2026-02-20*

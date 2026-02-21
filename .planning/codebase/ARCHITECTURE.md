# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Next.js App Router with webhook-driven event processing

**Key Characteristics:**
- Server-side authentication using iron-session (cookie-based)
- OAuth 2.0 integration with Calendly
- Webhook-triggered booking validation and cancellation
- Stripe webhook integration for subscription lifecycle
- Database-centric approach with Prisma ORM
- React Server Components for authenticated dashboard pages
- API routes following RESTful patterns

## Layers

**Presentation Layer:**
- Purpose: UI components and page rendering for authenticated users
- Location: `src/app/(dashboard)/` and `src/components/`
- Contains: React Server Components (TSX), UI component library (shadcn/ui), dashboard pages
- Depends on: Session management, Prisma for data fetching
- Used by: Browser clients

**API Layer:**
- Purpose: RESTful endpoints for client operations and webhook handling
- Location: `src/app/api/`
- Contains: Route handlers (auth, allowlists, webhooks, billing, settings)
- Depends on: Prisma, external APIs (Calendly, Stripe), session management
- Used by: Frontend, external services (Calendly, Stripe webhooks)

**Authentication/Session Layer:**
- Purpose: User identity and authorization management
- Location: `src/lib/session.ts`, `src/app/api/auth/`
- Contains: Session configuration (iron-session), OAuth flow implementation
- Depends on: Prisma, Calendly OAuth
- Used by: All authenticated routes and API endpoints

**Service Integration Layer:**
- Purpose: External API communication and abstraction
- Location: `src/lib/calendly.ts`, `src/lib/stripe.ts`, `src/lib/webhook.ts`
- Contains: API clients, OAuth helpers, webhook verification
- Depends on: axios, stripe SDK, crypto utilities
- Used by: API routes, webhook handlers

**Data Layer:**
- Purpose: Database schema and ORM operations
- Location: `prisma/schema.prisma`, `src/lib/prisma.ts`
- Contains: Prisma client singleton, database schema definitions
- Depends on: PostgreSQL
- Used by: All layers requiring data persistence

**Utilities Layer:**
- Purpose: Shared helper functions and constants
- Location: `src/lib/utils.ts`
- Contains: Date formatting, email validation, tier limits configuration
- Depends on: None
- Used by: Components and API routes

## Data Flow

**OAuth Signup/Login Flow:**

1. User clicks "Sign In" on landing page → `src/app/page.tsx`
2. Redirects to `/api/auth/calendly` → `src/app/api/auth/calendly/route.ts`
3. User authorizes at Calendly → Calendly redirects to `/api/auth/calendly/callback`
4. Callback handler (`src/app/api/auth/calendly/callback/route.ts`):
   - Exchanges authorization code for tokens using `exchangeCodeForTokens()` from `src/lib/calendly.ts`
   - Fetches user info from Calendly via `getCalendlyUser()`
   - Creates or updates User record in database (Prisma)
   - Creates default global allowlist for new users
   - Creates webhook subscription with Calendly for invitee.created events
   - Sets iron-session cookie
   - Redirects to `/dashboard`

**State Management:**
- User authentication state: Stored in iron-session cookie (server-side secure)
- User allowlist and booking data: Stored in PostgreSQL via Prisma
- Calendly tokens: Stored encrypted in User model (calendlyAccessToken, calendlyRefreshToken)
- Stripe subscription state: Stored in User model with Stripe IDs

**Booking Interception & Cancellation Flow:**

1. User books meeting on Calendly
2. Calendly sends `invitee.created` webhook to `/api/webhooks/calendly` → `src/app/api/webhooks/calendly/route.ts`
3. Webhook handler:
   - Verifies signature using `verifyWebhookSignature()` from `src/lib/webhook.ts`
   - Extracts invitee email and guest emails from payload
   - Queries User and global allowlist entries from database
   - Evaluates approval based on user's `guestCheckMode` (STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL)
   - Creates BookingAttempt record for audit
   - If NOT approved: Delays 4 seconds, then calls `cancelCalendlyEvent()` to cancel with custom message
   - Returns success response to Calendly

**Subscription Management Flow:**

1. User clicks "Upgrade" in dashboard
2. `src/app/api/billing/checkout` creates Stripe session via `createCheckoutSession()`
3. User completes payment on Stripe
4. Stripe sends webhook to `/api/webhooks/stripe` → `src/app/api/webhooks/stripe/route.ts`
5. Webhook handler:
   - Verifies Stripe signature
   - Updates User subscription fields based on event type (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed)
   - Billing portal: User can access Stripe customer portal via `/api/billing/portal`

## Key Abstractions

**CalendlyRequest Helper:**
- Purpose: Automatic token refresh on 401 responses
- Examples: `src/lib/calendly.ts` - `calendlyRequest<T>()` function
- Pattern: Higher-order function wrapping API calls with error handling and retry logic

**AuthMiddleware (Dashboard Layout):**
- Purpose: Enforce authentication on protected routes
- Examples: `src/app/(dashboard)/layout.tsx`
- Pattern: Async server component that redirects unauthenticated users

**WebhookVerification:**
- Purpose: Validate incoming webhook signatures from Calendly and Stripe
- Examples: `src/lib/webhook.ts` - `verifyWebhookSignature()`, `isTimestampValid()`
- Pattern: Cryptographic verification with HMAC-SHA256

**AllowlistEvaluation:**
- Purpose: Multi-mode guest checking logic
- Examples: `src/app/api/webhooks/calendly/route.ts` - lines 154-206
- Pattern: Switch statement implementing 5 different approval modes

**UI Component Library:**
- Purpose: Consistent, reusable shadcn/ui components
- Examples: `src/components/ui/` directory (button, card, dialog, badge, etc.)
- Pattern: Radix UI primitives + Tailwind CSS with CVA styling

## Entry Points

**Home Page:**
- Location: `src/app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Public landing page, OAuth redirect buttons, pricing display, feature showcase

**Dashboard Layout:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: Any route under `/dashboard/*`
- Responsibilities: Auth check, layout structure (sidebar + header), protected route guard

**Dashboard Pages:**
- `src/app/(dashboard)/dashboard/page.tsx`: Overview with stats, recent activity
- `src/app/(dashboard)/dashboard/allowlist/page.tsx`: Manage allowlist entries
- `src/app/(dashboard)/dashboard/activity/page.tsx`: Booking attempt history
- `src/app/(dashboard)/dashboard/settings/page.tsx`: User settings, cancel message, guest mode

**API Entry Points:**
- `/api/auth/*`: Authentication flow (calendly, callback, logout, me)
- `/api/allowlists/*`: CRUD operations for allowlists and entries
- `/api/webhooks/*`: Incoming webhook handlers (Calendly, Stripe)
- `/api/billing/*`: Checkout and portal management
- `/api/settings/*`: User preference updates
- `/api/dashboard/*`: Stats and activity queries
- `/api/docs`: Swagger documentation endpoint

## Error Handling

**Strategy:** Try-catch blocks with logging and graceful degradation

**Patterns:**
- API routes: Return NextResponse.json() with appropriate HTTP status codes (401, 400, 500)
- Webhook handlers: Log errors, continue processing, don't throw (Calendly/Stripe expect 2xx)
- Token refresh: Automatic retry on 401 with refreshed token using `calendlyRequest()` helper
- Database errors: Propagate to caller, caught at route handler level
- OAuth failures: Redirect to home page with error query parameter
- Cancellation failures: Log attempt, still create BookingAttempt record with failure note

## Cross-Cutting Concerns

**Logging:**
- console.log with prefixed context (e.g., `[Calendly Webhook]`, `[Calendly OAuth]`)
- Development mode logs database queries via Prisma logging config
- No structured logging library (uses console)

**Validation:**
- Email validation: `isValidEmail()` utility in `src/lib/utils.ts`
- Zod for form submissions via shadcn/ui form components
- Required field checks in API handlers before database operations

**Authentication:**
- iron-session cookie with 1-week expiry
- Session required on all `/dashboard` routes (enforced by layout)
- Route handlers check `getCurrentUser()` before processing requests
- OAuth state parameter generated but not fully verified against stored state

**Rate Limiting:**
- Not implemented (consider for Stripe/Calendly API calls)
- Webhook handlers process all events immediately

---

*Architecture analysis: 2026-02-20*

# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
Protectly/
├── src/                       # Source code (TypeScript/React)
│   ├── app/                   # Next.js App Router (pages, layouts, API routes)
│   │   ├── (dashboard)/       # Authenticated routes with dashboard layout
│   │   │   └── dashboard/     # Dashboard pages
│   │   ├── api/               # RESTful API endpoints
│   │   │   ├── auth/          # OAuth and session endpoints
│   │   │   ├── allowlists/    # Allowlist CRUD operations
│   │   │   ├── webhooks/      # Incoming webhook handlers
│   │   │   ├── billing/       # Stripe checkout and portal
│   │   │   ├── settings/      # User settings updates
│   │   │   ├── dashboard/     # Stats and activity endpoints
│   │   │   └── docs/          # Swagger documentation
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Landing page
│   │   └── globals.css        # Global Tailwind styles
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── providers/         # Context providers (QueryProvider)
│   │   └── ui/                # Reusable UI library (shadcn/ui)
│   ├── lib/                   # Utility functions and services
│   │   ├── calendly.ts        # Calendly API client and OAuth
│   │   ├── stripe.ts          # Stripe API client
│   │   ├── session.ts         # iron-session configuration
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── webhook.ts         # Webhook signature verification
│   │   ├── utils.ts           # Date, email, tier limit helpers
│   │   └── swagger.ts         # Swagger/OpenAPI config
│   └── test/                  # Test setup and utilities
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma          # Prisma data model
│   └── migrations/            # Database migration history
├── e2e/                       # End-to-end tests (Playwright)
├── config/                    # Environment and build configuration
├── public/                    # Static assets
├── next.config.js             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── vitest.config.ts           # Unit test configuration
├── playwright.config.ts       # E2E test configuration
└── package.json               # Dependencies and scripts
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router with file-based routing (pages as `page.tsx`, API routes as `route.ts`)
- Contains: Server components, API handlers, layouts, middleware
- Key files: `layout.tsx` (providers), `page.tsx` (landing), `(dashboard)/layout.tsx` (auth guard)

**src/app/(dashboard)/:**
- Purpose: Protected routes group using route groups syntax
- Contains: Dashboard pages that require authentication
- Protected by: `layout.tsx` which calls `getCurrentUser()` and redirects unauthenticated users to `/`

**src/app/api/:**
- Purpose: RESTful API endpoints following Next.js API routes pattern (`route.ts` files)
- Contains: Request handlers organized by domain (auth, allowlists, webhooks, etc.)
- Pattern: Each `route.ts` file exports `GET`, `POST`, `PUT`, `DELETE` handlers

**src/components/:**
- Purpose: Reusable React components organized by feature/type
- `dashboard/`: Domain-specific components (AllowlistTable, AddEmailDialog, etc.)
- `ui/`: Generic UI components from shadcn/ui (Button, Card, Dialog, etc.)
- `providers/`: React context providers for client-side state (QueryProvider for React Query)

**src/lib/:**
- Purpose: Shared business logic, API clients, and utilities
- `calendly.ts`: Calendly OAuth flow, API client, webhook creation/cancellation
- `stripe.ts`: Stripe client, checkout session creation, subscription management
- `session.ts`: iron-session configuration, getCurrentUser() helper
- `prisma.ts`: Prisma client singleton with logging configuration
- `webhook.ts`: Signature verification for Calendly and Stripe webhooks
- `utils.ts`: Date formatting, email validation, tier limit constants

**prisma/:**
- Purpose: Database schema definition and migration management
- `schema.prisma`: Complete data model with enums (SubscriptionTier, GuestCheckMode, BookingStatus)
- Models: User, EventType, Allowlist, AllowlistEntry, BookingAttempt

**e2e/:**
- Purpose: End-to-end tests using Playwright framework
- Files: Authentication setup, landing page tests, dashboard tests

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Public landing page with hero, features, pricing sections
- `src/app/(dashboard)/layout.tsx`: Auth-protected dashboard layout with sidebar/header
- `src/app/(dashboard)/dashboard/page.tsx`: Dashboard homepage with stats and recent activity
- `src/app/api/auth/calendly/route.ts`: OAuth initiation endpoint
- `src/app/api/auth/calendly/callback/route.ts`: OAuth callback handler

**Configuration:**
- `next.config.js`: Next.js build config
- `tailwind.config.ts`: Tailwind CSS with custom colors and animations
- `vitest.config.ts`: Unit test runner configuration
- `playwright.config.ts`: E2E test configuration with authentication setup

**Core Logic:**
- `src/lib/calendly.ts`: All Calendly API integration and OAuth
- `src/app/api/webhooks/calendly/route.ts`: Booking validation and cancellation logic
- `src/app/api/webhooks/stripe/route.ts`: Subscription lifecycle management
- `prisma/schema.prisma`: Complete data model and relationships

**Testing:**
- `src/test/setup.ts`: Test utilities and global setup
- `src/lib/utils.test.ts`: Unit tests for utility functions
- `e2e/auth.setup.ts`: Playwright authentication setup for all E2E tests
- `e2e/*.spec.ts`: Individual E2E test suites

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase (e.g., `AllowlistTable.tsx`, `AddEmailDialog.tsx`)
- Utilities: camelCase (e.g., `calendly.ts`, `stripe.ts`)
- Tests: `*.test.ts` or `*.spec.ts` suffix
- Layouts: `layout.tsx` (Next.js convention)

**Directories:**
- Feature-based organization: `/api/allowlists/`, `/api/webhooks/`
- Route groups with parentheses: `(dashboard)/` to group authenticated routes
- Dynamic routes with brackets: `[id]/` for path parameters

**Variables & Functions:**
- camelCase for variables, functions, and parameters
- PascalCase for React components, TypeScript types, and interfaces
- UPPER_CASE for constants (e.g., `TIER_LIMITS`, `PRICIAL_BRANDING`)

## Where to Add New Code

**New Feature (complete end-to-end):**
- API logic: `src/app/api/[feature]/route.ts`
- Database model: Add to `prisma/schema.prisma`
- Service utility: `src/lib/[feature].ts` (if external integration)
- Components: `src/components/dashboard/[feature].tsx`
- Pages: `src/app/(dashboard)/dashboard/[feature]/page.tsx`
- Tests: `e2e/[feature].spec.ts` and `src/lib/[feature].test.ts`

**New Component/Module:**
- Implementation: `src/components/dashboard/[component-name].tsx` (dashboard) or `src/components/ui/[component-name].tsx` (generic)
- Usage: Import and use in pages or other components

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (already contains formatDate, formatRelativeTime, isValidEmail, etc.)
- External service wrappers: `src/lib/[service-name].ts` (e.g., calendly.ts, stripe.ts)
- Constants: At top of service file or in `src/lib/utils.ts` alongside TIER_LIMITS

## Special Directories

**src/app/api/:**
- Purpose: RESTful endpoints following Next.js App Router pattern
- Generated: No
- Committed: Yes

**src/components/ui/:**
- Purpose: shadcn/ui component library (can be regenerated)
- Generated: Partially (components from `npx shadcn-ui add`)
- Committed: Yes (committed after generation)

**prisma/migrations/:**
- Purpose: Database migration history
- Generated: Yes (auto-generated by `prisma migrate dev`)
- Committed: Yes (essential for reproducibility)

**.next/:**
- Purpose: Build output directory
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-20*

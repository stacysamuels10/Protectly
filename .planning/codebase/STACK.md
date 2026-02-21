# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript 5.3.3 - Entire application including API routes, components, and utilities
- TSX/JSX - React component markup in `src/components/` and `src/app/`

**Secondary:**
- JavaScript - Configuration files (next.config.js, tailwind.config.ts uses ts-node)
- CSS - Tailwind CSS utility classes

## Runtime

**Environment:**
- Node.js - Required version not explicitly specified; lockfile indicates modern version support
- Next.js 15.1.3 - Full-stack React framework with integrated API routes and built-in deployment support

**Package Manager:**
- npm 10+ (inferred from package-lock.json size and structure)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.1.3 - Full-stack React framework with App Router, API routes, and SSR/SSG
- React 19.0.0 - UI library and component framework
- React DOM 19.0.0 - React rendering for web

**Database & ORM:**
- Prisma 5.7.1 - Database ORM and schema management with migration support

**UI Components & Styling:**
- Radix UI (multiple packages v1.0.x) - Accessible component primitives
  - `@radix-ui/react-avatar` - Avatar component
  - `@radix-ui/react-dialog` - Dialog/modal component
  - `@radix-ui/react-dropdown-menu` - Dropdown menu component
  - `@radix-ui/react-label` - Form label component
  - `@radix-ui/react-select` - Select dropdown component
  - `@radix-ui/react-separator` - Visual separator component
  - `@radix-ui/react-tabs` - Tab navigation component
  - `@radix-ui/react-toast` - Toast notification component
  - `@radix-ui/react-tooltip` - Tooltip component
- Tailwind CSS 3.4.1 - Utility-first CSS framework for styling
- Tailwind Merge 2.2.0 - Merge Tailwind CSS classes without conflicts
- Class Variance Authority 0.7.0 - Type-safe component variant management
- clsx 2.1.0 - Class name utility for conditional styling

**Testing:**
- Vitest 4.0.16 - Unit test framework with happy-dom environment
- Playwright 1.57.0 - E2E test framework with multiple browser support
- @testing-library/react 16.3.1 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- happy-dom 20.0.11 - Lightweight DOM implementation for testing

**Build & Development:**
- TypeScript 5.3.3 - Static type checking
- PostCSS 8.4.33 - CSS transformation and processing
- Autoprefixer 10.4.16 - Vendor prefix auto-adding
- ESLint 8.56.0 - Code linting with Next.js config
- Next.js built-in linting - Integrated with ESLint

**Documentation & API:**
- Swagger JSDoc 6.2.8 - Generate OpenAPI/Swagger docs from JSDoc comments
- Swagger UI React 5.31.0 - Interactive API documentation interface

**Utilities:**
- Axios 1.6.3 - HTTP client for making API requests (used for Calendly API calls)
- Zod 3.22.4 - Runtime type validation and schema parsing
- date-fns 3.2.0 - Date manipulation and formatting utilities
- lucide-react 0.468.0 - Icon library
- iron-session 8.0.1 - Encrypted session management for authentication
- @stripe/stripe-js 2.2.2 - Stripe.js SDK for client-side payment handling
- stripe 14.11.0 - Stripe Node.js SDK for server-side payment operations
- node-fetch 3.3.2 - Polyfill for fetch API (dev dependency)

**API & SDK Integration:**
- OpenAI 6.16.0 - OpenAI API client (installed but usage not evident in current scope)
- @octokit/rest 22.0.1 - GitHub API client (used in build scripts for issue/sprint creation)

## Configuration

**Environment:**
- Environment variables configured via `.env.local` (note: `.env` file present in repo root - contains config only, never commit)
- See INTEGRATIONS.md for required environment variables

**Build Configuration:**
- TypeScript: `tsconfig.json` with strict mode enabled, ES2017 target, path aliasing (`@/*` → `./src/*`)
- Next.js: `next.config.js` with React strict mode, image optimization from CloudFront
- PostCSS: `postcss.config.js` for Tailwind CSS integration
- Tailwind: `tailwind.config.ts` with animation plugins
- ESLint: `.eslintrc.json` with Next.js recommended rules

**Database Configuration:**
- Prisma: `prisma/schema.prisma` with PostgreSQL provider
- Schema defines: User, EventType, Allowlist, AllowlistEntry, BookingAttempt models
- Seed script: `prisma/seed.ts` with ts-node configuration
- Migrations: `prisma/migrations/` directory for version control

**Testing Configuration:**
- Vitest: `vitest.config.ts` with happy-dom environment, React plugin, coverage reporting (v8)
- Playwright: `playwright.config.ts` with Chromium browser, baseURL http://localhost:3000, auto dev server startup
- Test files: Located co-located with source as `*.test.ts` or `*.spec.ts`

## Platform Requirements

**Development:**
- Node.js (version TBD, modern LTS recommended)
- npm or yarn as package manager
- Git for version control
- PostgreSQL (for local database development)

**Production:**
- Deployment targets: Vercel (primary via vercel.json) or Railway (via railway.json)
- Vercel regions: `iad1` (US East)
- API functions timeout: 30 seconds max
- Node.js runtime (Vercel or Railway managed)
- PostgreSQL database (serverless or hosted, configured via DATABASE_URL)

**API Endpoints:**
- App runs on port 3000 (default Next.js dev server and test baseURL)
- API routes served from `/api/*` paths via Next.js App Router

---

*Stack analysis: 2026-02-20*

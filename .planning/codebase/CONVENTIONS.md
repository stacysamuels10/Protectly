# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Page components: `page.tsx` (Next.js App Router convention) - e.g., `src/app/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
- API routes: `route.ts` - e.g., `src/app/api/auth/me/route.ts`
- UI components: `component-name.tsx` (kebab-case) - e.g., `button.tsx`, `dropdown-menu.tsx` in `src/components/ui/`
- Feature components: `component-name.tsx` (kebab-case) - e.g., `add-email-dialog.tsx`, `allowlist-table.tsx` in `src/components/dashboard/`
- Utility modules: `module-name.ts` (kebab-case) - e.g., `utils.ts`, `session.ts` in `src/lib/`
- Test files: `*.test.ts` or `*.test.tsx` - e.g., `utils.test.ts`, `button.test.tsx`

**Functions:**
- Named exports for utilities and handlers: camelCase - e.g., `formatDate()`, `getCurrentUser()`, `isValidEmail()`
- Async functions named without "Async" suffix - e.g., `getCurrentUser()` not `getCurrentUserAsync()`
- Handler functions in API routes: `GET`, `POST`, `PUT`, `DELETE` (HTTP verb names in capitals)
- React component functions: PascalCase - e.g., `Button`, `Header`, `QueryProvider`
- Hook-like providers: PascalCase with "Provider" suffix - e.g., `QueryProvider`
- Internal helper functions: camelCase, often prefixed with underscore if private - e.g., `_authenticateUser()`

**Variables:**
- Constants: SCREAMING_SNAKE_CASE - e.g., `TIER_LIMITS`, `SESSION_SECRET`
- Regular variables: camelCase - e.g., `allowlists`, `user`, `searchParams`
- Boolean variables: prefix with `is` or suffix with flag - e.g., `isLoggedIn`, `isValidEmail`
- React state: camelCase - e.g., `const [queryClient, setQueryClient] = useState()`

**Types:**
- Interfaces: PascalCase - e.g., `ButtonProps`, `HeaderProps`, `SessionData`
- Type aliases: PascalCase - e.g., `ClassValue`, `VariantProps`
- Enum-like objects: SCREAMING_SNAKE_CASE keys in object - e.g., `TIER_LIMITS.FREE`, `TIER_LIMITS.PRO`

## Code Style

**Formatting:**
- No explicit formatter configured (prettier not in project)
- Consistent indentation: 2 spaces (observed across files)
- Line length: No strict limit observed, but API JSDoc is well-formatted
- Quotes: Single quotes for strings in TypeScript/JavaScript code

**Linting:**
- ESLint with Next.js configuration
- Config: `.eslintrc.json`
- Key rules:
  - `@typescript-eslint/no-unused-vars`: warn
  - `@typescript-eslint/no-explicit-any`: warn
  - Extends: `next/core-web-vitals` and `next/typescript`

## Import Organization

**Order:**
1. React/Next.js imports (e.g., `import * as React from 'react'`, `import { NextResponse } from 'next/server'`)
2. Third-party library imports (e.g., `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'`)
3. Relative imports using path aliases (e.g., `import { cn } from '@/lib/utils'`, `import { Button } from '@/components/ui/button'`)
4. Type imports when needed (e.g., `import type { Metadata } from 'next'`)

**Path Aliases:**
- `@/*` maps to `./src/*` - use this for all internal imports
- All imports within `src/` use the `@/` alias, no relative `../../` paths
- Example: `import { prisma } from '@/lib/prisma'` instead of `import { prisma } from '../../../lib/prisma'`

## Error Handling

**Patterns:**
- Try-catch blocks in async operations: `try { ... } catch (error: any) { ... }`
- API error responses: Return `NextResponse.json({ error: 'message' }, { status: 401 })`
- Null checks before operations: `if (!user) { return NextResponse.json(..., { status: 401 }) }`
- Zod for validation with `.safeParse()` for graceful failures: `const parsed = schema.safeParse(body)`
- Check parsed result: `if (!parsed.success) { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }) }`
- Graceful degradation in OAuth callbacks: `if (!code) { return NextResponse.redirect(...) }`

**Example from `src/app/api/auth/calendly/callback/route.ts`:**
```typescript
try {
  const tokens = await exchangeCodeForTokens(code)
  // ... operations
} catch (error) {
  console.error("Error message:", error)
  return NextResponse.redirect(`${appUrl}/?error=oauth_failed`)
}
```

## Logging

**Framework:** `console` (no external logger configured)

**Patterns:**
- Use `console.error()` for errors: `console.error("Calendly OAuth error:", error)`
- Use `console.log()` for info: `console.log("[Calendly OAuth] Webhook URL configured as:", webhookUrl)`
- Prefix log messages with context in brackets: `[Context Name]` - e.g., `[Calendly OAuth]`
- Logging is conditional on environment: Prisma logs queries/errors in development only

## Comments

**When to Comment:**
- Complex business logic requiring explanation: `// Always try to create/update webhook subscription on login`
- Non-obvious conditionals: `// Branding suffix that is always appended to cancellation messages`
- Configuration explanations: `// Verify the entry exists` before database queries
- Implementation notes for future developers

**JSDoc/TSDoc:**
- Swagger JSDoc annotations on API routes (not traditional JSDoc)
- Format: Block comment starting with `/**` and `@swagger`
- Example from `src/app/api/auth/me/route.ts`:
```typescript
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     description: Returns the currently authenticated user's information
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Current user information
 */
```

## Function Design

**Size:** Functions kept reasonably concise, typically 20-50 lines for utility functions
- Example: `formatDate()` is 8 lines, `formatRelativeTime()` is 25 lines
- API handlers are 10-30 lines for simple operations, more for complex ones with validation

**Parameters:**
- Use destructuring for object parameters: `{ className, variant, size, asChild = false, ...props }`
- Use type interfaces for complex objects: `{ params }: { params: Promise<{ id: string }> }`
- Props passed as single object to React components with TypeScript interface

**Return Values:**
- Functions return typed values: `function formatDate(date: Date | string): string`
- Async functions return Promises: `async function getCurrentUser(): Promise<User | null>`
- API handlers return `NextResponse` objects
- Component functions return JSX/React.ReactNode

## Module Design

**Exports:**
- Named exports for utilities and functions: `export function cn(...inputs: ClassValue[])`
- Named exports for React components: `export { Button, buttonVariants }`
- Default exports for page components: `export default function RootLayout()`
- Re-exports from component files: `export { Button, buttonVariants }` allows importing from single file

**Barrel Files:**
- Not heavily used, but components are exported individually from their modules
- UI components are organized by feature in `src/components/ui/` and imported with full path: `@/components/ui/button`
- Dashboard components in `src/components/dashboard/` similarly imported with full path

**Provider Pattern:**
- Providers are exported as functions: `export function QueryProvider({ children }: { children: React.ReactNode })`
- Used in layout files to wrap children: `<QueryProvider>{children}</QueryProvider>`
- Example: `src/components/providers/query-provider.tsx` for React Query setup

## React/Next.js Specific Conventions

**Client Components:**
- Explicitly marked with `'use client'` directive at top of file
- Example: `src/components/providers/query-provider.tsx` and `src/components/dashboard/header.tsx`

**Async Components/Server Components:**
- Default in App Router unless marked with `'use client'`
- API route handlers are async: `export async function GET(request: NextRequest)`

**Component Forwarding:**
- Use `React.forwardRef` for components that need ref forwarding
- Example from `src/components/ui/button.tsx`:
```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(...)} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
```

**Type Safety:**
- Use TypeScript strict mode (enabled in `tsconfig.json`)
- Define interfaces for props: `interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants>`
- Use proper typing for Next.js specific features: `import type { Metadata } from 'next'`

---

*Convention analysis: 2026-02-20*

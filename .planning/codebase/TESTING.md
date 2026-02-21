# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Vitest 4.0.16 (config: `vitest.config.ts`)
- Environment: happy-dom (lightweight DOM implementation)
- Globals enabled for test functions (no need to import describe/it/expect in every file)

**Assertion Library:**
- Vitest built-in assertions via `expect()`
- @testing-library/jest-dom for DOM matchers (`.toBeInTheDocument()`, `.toHaveClass()`, etc.)
- @testing-library/react for component rendering and interaction
- @testing-library/user-event for user interaction simulation

**Run Commands:**
```bash
npm test                  # Run tests in watch mode
npm run test:run          # Run tests once (CI mode)
npm run test:ui           # Open Vitest UI dashboard
npm run test:coverage     # Generate coverage report
```

## Test File Organization

**Location:**
- Co-located with source files (same directory as implementation)
- Example: `src/lib/utils.ts` has `src/lib/utils.test.ts` in same directory
- Example: `src/components/ui/button.tsx` has `src/components/ui/button.test.tsx` in same directory

**Naming:**
- Extension: `.test.ts` or `.test.tsx`
- Pattern: `[module-name].test.ts` matches the implementation file exactly

**Structure:**
```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
├── components/
│   └── ui/
│       ├── button.tsx
│       └── button.test.tsx
└── test/
    └── setup.ts
```

## Test Structure

**Suite Organization:**
```typescript
// From src/lib/utils.test.ts
describe('cn (className merger)', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active')
  })
})

describe('formatDate', () => {
  it('should format a Date object correctly', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    const result = formatDate(date)
    expect(result).toMatch(/Jan/)
  })
})
```

**Patterns:**
- Top-level `describe()` block per function/component being tested
- Nested `it()` blocks for each test case
- Descriptive test names starting with "should": `'should merge class names correctly'`
- Arrange-Act-Assert pattern (implicit in most tests)
- One primary assertion per test case, multiple related assertions acceptable

**Setup and Teardown:**
- Global setup file: `src/test/setup.ts` (configured in `vitest.config.ts`)
- Cleanup happens automatically after each test via `afterEach(() => { cleanup() })`
- Fake timers example from `src/lib/utils.test.ts`:
```typescript
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "just now" for times less than a minute ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)
    // ... test code
  })
})
```

## Mocking

**Framework:** Vitest `vi` object for mocking

**Patterns:**

Global mocks in `src/test/setup.ts`:
```typescript
// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock window.matchMedia for media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

Test-level mocks from `src/components/ui/button.test.tsx`:
```typescript
const handleClick = vi.fn()
render(<Button onClick={handleClick}>Click me</Button>)
expect(handleClick).toHaveBeenCalledTimes(1)
```

**What to Mock:**
- Browser APIs: `window.matchMedia`, `ResizeObserver`, navigation
- External libraries: `next/navigation` router functions
- Event handlers: Mock click handlers, form submissions
- API calls: Mock fetch or axios calls in integration tests

**What NOT to Mock:**
- Pure utility functions: Test them directly with real inputs/outputs
- Component rendering logic: Use actual component tree unless testing integration
- DOM APIs that jsdom supports: `document.querySelector`, event listeners

## Fixtures and Factories

**Test Data:**
- Inline data in tests (no factory pattern observed yet)
- Example from `src/lib/utils.test.ts`:
```typescript
it('should format a Date object correctly', () => {
  const date = new Date('2024-01-15T12:00:00Z')
  const result = formatDate(date)
  expect(result).toMatch(/Jan/)
})
```

- Constants reused across tests: `TIER_LIMITS` from `src/lib/utils.ts` used directly in tests

**Location:**
- No dedicated fixtures directory
- Test data defined within test files (`src/lib/utils.test.ts`, `src/components/ui/button.test.tsx`)
- Could be extracted to `src/test/fixtures/` if tests grow

## Coverage

**Requirements:** No coverage target enforced (no pre-commit hook)

**View Coverage:**
```bash
npm run test:coverage
# Generates reports in coverage/ directory (HTML, JSON, text)
# Config in vitest.config.ts:
# coverage:
#   provider: 'v8'
#   reporter: ['text', 'json', 'html']
#   exclude: ['node_modules/', '.next/', '**/*.d.ts', '**/*.config.*', '**/test/**']
```

## Test Types

**Unit Tests:**
- Scope: Individual utility functions, components in isolation
- Approach: Test a single function/component with various inputs
- Examples:
  - `formatDate()` tests different date formats (Date object, date string)
  - `Button` component tests each variant (destructive, outline, ghost) and size (sm, lg, icon)
  - `isValidEmail()` tests valid and invalid email formats

**Integration Tests:**
- Scope: Component interactions, user flows
- Approach: Render component tree, simulate user events, verify results
- Example from `src/components/ui/button.test.tsx`:
```typescript
it('handles click events', async () => {
  const user = userEvent.setup()
  const handleClick = vi.fn()

  render(<Button onClick={handleClick}>Click me</Button>)

  const button = screen.getByRole('button')
  await user.click(button)

  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

**E2E Tests:**
- Framework: Playwright (configured but not deeply analyzed in this scope)
- Commands: `npm run e2e`, `npm run e2e:ui`, `npm run e2e:headed`, `npm run e2e:report`
- Located in: `e2e/` directory (separate from unit/integration tests)

## Common Patterns

**Async Testing:**
```typescript
// From src/components/ui/button.test.tsx
it('handles click events', async () => {
  const user = userEvent.setup()
  render(<Button onClick={handleClick}>Click me</Button>)

  const button = screen.getByRole('button')
  await user.click(button)  // Wait for user event completion

  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

**Error Testing:**
```typescript
// Testing disabled state prevents action
it('does not trigger click when disabled', async () => {
  const user = userEvent.setup()
  const handleClick = vi.fn()

  render(<Button disabled onClick={handleClick}>Disabled</Button>)

  const button = screen.getByRole('button')
  await user.click(button)

  expect(handleClick).not.toHaveBeenCalled()
})
```

**DOM Query Patterns:**
```typescript
// Use semantic queries (accessible to screen readers)
const button = screen.getByRole('button', { name: /click me/i })
const link = screen.getByRole('link', { name: /link button/i })

// For elements without roles, use other queries
const element = screen.getByText('some text')

// Check for existence
expect(button).toBeInTheDocument()

// Check attributes
expect(link).toHaveAttribute('href', '/test')

// Check classes (for Tailwind/CSS validation)
expect(button).toHaveClass('bg-primary')
expect(button).toHaveClass('h-10')
```

**Component Composition Testing:**
```typescript
// From src/components/ui/button.test.tsx
it('supports asChild prop for composition', () => {
  render(
    <Button asChild>
      <a href="/test">Link Button</a>
    </Button>
  )

  const link = screen.getByRole('link', { name: /link button/i })
  expect(link).toBeInTheDocument()
  expect(link).toHaveAttribute('href', '/test')
})
```

**Ref Forwarding Testing:**
```typescript
// From src/components/ui/button.test.tsx
it('forwards ref correctly', () => {
  const ref = vi.fn()
  render(<Button ref={ref}>Ref Button</Button>)

  expect(ref).toHaveBeenCalled()
})
```

**Variant/Props Testing:**
```typescript
// Test variant combinations
describe('Button variants', () => {
  it('applies default variant and size classes', () => {
    render(<Button>Default</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-primary')
    expect(button).toHaveClass('h-10')
  })

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })
})
```

**Time-Based Testing:**
```typescript
// From src/lib/utils.test.ts
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "just now" for times less than a minute ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const thirtySecondsAgo = new Date('2024-01-15T11:59:35')
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  it('should return minutes ago for times less than an hour ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const fiveMinutesAgo = new Date('2024-01-15T11:55:00')
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
  })
})
```

---

*Testing analysis: 2026-02-20*

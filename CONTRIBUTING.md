# Contributing to PriCal

Thank you for your interest in contributing to PriCal! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Architecture Overview](#architecture-overview)

---

## Code of Conduct

Please be respectful and constructive in all interactions. We're building a welcoming community for all contributors.

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or use Neon for cloud database)
- Git

### Setup Development Environment

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/prical.git
   cd prical
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env.local
   ```

   Fill in the required values (see README.md for details).

4. **Set up the database**

   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Verify tests pass**

   ```bash
   npm run test:run
   npm run e2e
   ```

---

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-csv-import` - New features
- `fix/webhook-signature-validation` - Bug fixes
- `docs/update-api-reference` - Documentation updates
- `refactor/simplify-auth-flow` - Code refactoring
- `test/add-billing-tests` - Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(allowlist): add CSV import functionality

- Parse CSV files with email validation
- Support bulk upload up to 1000 entries
- Show progress indicator during import

Closes #123
```

```
fix(webhook): handle missing invitee email gracefully

Previously, webhooks would fail if invitee email was null.
Now we log a warning and skip processing.
```

---

## Code Style

### TypeScript

- Use TypeScript for all new code
- Enable strict mode (already configured)
- Prefer explicit types over `any`
- Use interfaces for object shapes

```typescript
// Good
interface User {
  id: string
  email: string
  name: string | null
}

function getUser(id: string): Promise<User | null> {
  // ...
}

// Avoid
function getUser(id: any): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Prefer composition over inheritance
- Use `forwardRef` when exposing refs
- Keep components focused and small

```typescript
// Good - focused component
export function EmailBadge({ email, onRemove }: EmailBadgeProps) {
  return (
    <Badge>
      {email}
      <button onClick={onRemove}>×</button>
    </Badge>
  )
}

// Avoid - component doing too much
export function AllowlistManager() {
  // 500 lines of code...
}
```

### File Organization

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── dashboard/          # Feature-specific components
│   ├── providers/          # React context providers
│   └── ui/                 # Reusable UI components
├── lib/                    # Utilities and helpers
└── test/                   # Test utilities
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | kebab-case | `add-email-dialog.tsx` |
| Files (utilities) | kebab-case | `utils.ts` |
| Components | PascalCase | `AddEmailDialog` |
| Functions | camelCase | `formatDate` |
| Constants | SCREAMING_SNAKE_CASE | `TIER_LIMITS` |
| Types/Interfaces | PascalCase | `AllowlistEntry` |

### Imports

Order imports as follows:

```typescript
// 1. React/Next.js
import { useState } from 'react'
import Link from 'next/link'

// 2. Third-party libraries
import { format } from 'date-fns'
import { z } from 'zod'

// 3. Internal components
import { Button } from '@/components/ui/button'
import { AddEmailDialog } from '@/components/dashboard/add-email-dialog'

// 4. Internal utilities
import { cn, formatDate } from '@/lib/utils'
import { prisma } from '@/lib/prisma'

// 5. Types
import type { User, AllowlistEntry } from '@prisma/client'
```

---

## Testing Guidelines

### Test File Location

Place test files next to the code they test:

```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts        # Unit tests
├── components/
│   └── ui/
│       ├── button.tsx
│       └── button.test.tsx  # Component tests
e2e/
├── landing-page.spec.ts     # E2E tests
└── dashboard.spec.ts
```

### Unit Tests (Vitest)

Test pure functions and utilities:

```typescript
import { describe, it, expect } from 'vitest'
import { isValidEmail } from './utils'

describe('isValidEmail', () => {
  it('should return true for valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('should return false for invalid email', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
  })
})
```

### Component Tests (React Testing Library)

Test component behavior, not implementation:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await userEvent.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### E2E Tests (Playwright)

Test user flows and integration:

```typescript
import { test, expect } from '@playwright/test'

test('user can add email to allowlist', async ({ page }) => {
  // Navigate to allowlist page
  await page.goto('/dashboard/allowlist')
  
  // Click add email button
  await page.getByRole('button', { name: /add email/i }).click()
  
  // Fill in email
  await page.getByLabel('Email').fill('test@example.com')
  
  // Submit
  await page.getByRole('button', { name: /add/i }).click()
  
  // Verify email appears in list
  await expect(page.getByText('test@example.com')).toBeVisible()
})
```

### Test Coverage Expectations

| Type | Minimum Coverage |
|------|------------------|
| Utility functions | 90%+ |
| UI components | 80%+ |
| API routes | 70%+ |
| E2E critical paths | 100% |

### Running Tests

```bash
# Unit tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage

# E2E tests
npm run e2e           # Headless
npm run e2e:ui        # Interactive UI
npm run e2e:headed    # With browser visible
```

---

## Pull Request Process

### Before Submitting

1. **Update from main**

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks**

   ```bash
   npm run lint
   npm run type-check
   npm run test:run
   npm run e2e
   ```

3. **Update documentation** if needed

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested the changes.

## Checklist
- [ ] Tests pass locally
- [ ] Lint passes
- [ ] Types check
- [ ] Documentation updated (if needed)
```

### Review Process

1. All PRs require at least one review
2. Address review feedback
3. Squash commits before merging (if requested)
4. Delete branch after merge

---

## Architecture Overview

### Authentication Flow

```
User → Click "Sign In"
  → Redirect to /api/auth/calendly
  → Redirect to Calendly OAuth
  → Callback to /api/auth/calendly/callback
  → Create/update user in database
  → Create session cookie
  → Redirect to /dashboard
```

### Webhook Processing

```
Calendly → POST /api/webhooks/calendly
  → Verify webhook signature
  → Parse event data
  → Check allowlist for invitee email
  → If not allowed → Cancel meeting via Calendly API
  → Log booking attempt
  → Return 200 OK
```

### Database Schema

```
User
  ├── EventType[] (Calendly event types)
  ├── Allowlist[] (one global, or per event type)
  │     └── AllowlistEntry[] (approved emails)
  └── BookingAttempt[] (audit log)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/session.ts` | Session management |
| `src/lib/calendly.ts` | Calendly API integration |
| `src/lib/stripe.ts` | Stripe billing |
| `src/lib/webhook.ts` | Webhook processing |
| `src/app/api/webhooks/calendly/route.ts` | Main webhook handler |

---

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Email: dev@prical.io

Thank you for contributing! 🙏


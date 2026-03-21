# Phase 8: Email Infrastructure & Preferences - Research

**Researched:** 2026-03-21
**Domain:** Transactional email (Resend + React Email) + Next.js settings API + Prisma schema migration
**Confidence:** HIGH — packages verified against npm registry; patterns verified against existing codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Clean minimal style — white background, single-column, no heavy branding. Like Stripe or Linear notification emails.
- **D-02:** Tone is warm and professional — not stiff corporate, not overly casual. Helpful and clear.
- **D-03:** BookingRejected email shows the specific rejection reason (not on allowlist, unapproved guest, guest check mode) so the user can decide whether to add the person.
- **D-04:** Three separate per-type toggles on the settings page:
  - Approved booking notifications (default: ON)
  - Rejected booking notifications (default: ON)
  - Trial warning notifications (default: ON)
- **D-05:** Email preferences card placed after Guest Checking card on the settings page, before Cancel Message and Delete Account.
- **D-06:** From name: "PriCal Notifications"
- **D-07:** From address: notifications@prical.io
- **D-08:** Resend domain verification required on prical.io before production sends (24-48h DNS propagation).

### Claude's Discretion
- React Email component structure and shared layout
- Exact email subject lines for each template
- Toggle component implementation (Switch from Radix UI or custom)
- Reply-to address configuration
- Email preview text (inbox snippet)
- Exact Prisma migration column names for email preferences

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMAIL-01 | Email sending infrastructure set up (Resend account, sending utility in lib/email.ts, branded templates via React Email) | Resend SDK singleton pattern confirmed; React Email component architecture verified; 5 templates identified from architecture docs |
| EMAIL-04 | User can configure email notification preferences (approved bookings, rejected bookings) from settings page | Settings API route pattern confirmed from existing guest-check/route.ts; Prisma migration pattern identified; UI toggle pattern defined |
</phase_requirements>

---

## Summary

Phase 8 installs Resend + React Email and builds the email sending infrastructure that later phases (9 and 10) wire up to actual triggers. It also adds the three email preference boolean fields to the User Prisma model and surfaces per-type toggle controls on the settings page.

The codebase is well-prepared for this phase. The existing `src/lib/` pattern (singletons with `server-only` guard), the settings page Card layout, the API route structure (`getCurrentUser` + Zod validation + `NextResponse.json`), and the test patterns (vi.mock for server-only, module mocking) are all in place and directly applicable. No architectural decisions are ambiguous.

The single biggest operational risk is Resend domain DNS verification (24-48h propagation delay). This must be initiated at the start of Plan 08-01, before any code is written, so testing with real inboxes is not blocked. Resend's sandbox/test mode using the `resend.com` onboarding domain allows code validation during that window.

**Primary recommendation:** Install packages, initiate Resend domain verification immediately, build email.ts singleton and all five templates, then do the Prisma migration and settings UI in Plan 08-02. Templates can be validated with Resend's test mode while DNS propagates.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.9.4 | Transactional email sending via HTTP API | Project decision; modern REST API; native React Email support; 3,000/mo free tier; SOC 2 compliant |
| `react-email` | 5.2.10 | Email template authoring as React/TSX components | Project decision; renders to HTML string at send time; React 19 compatible; no separate compile step |
| `@react-email/components` | 1.0.10 | Pre-built email-safe HTML primitives (Body, Container, Text, Button, Hr, Link, Section, Row, Column) | Companion to react-email; ensures cross-client compatibility; handles Outlook table-based layout internally |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-switch` | 1.2.6 | Accessible toggle switch for email preference UI | Use for the three email notification toggles — no Switch component exists yet in `src/components/ui/` |
| `zod` (existing) | installed | Input validation on PATCH endpoint | Already in project; use same safeParse pattern as guest-check route |
| `prisma` (existing) | 5.7.1 | Schema migration for three new boolean columns | `npx prisma migrate dev` to generate and apply the migration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@radix-ui/react-switch` | Custom checkbox-styled toggle | Radix provides keyboard navigation, ARIA, and consistent behavior; custom toggle adds maintenance burden for no benefit |
| `@react-email/components` | Raw HTML table layouts | react-email components abstract away the cross-client email quirks; raw HTML is fragile and hard to maintain |

**Installation:**
```bash
npm install resend react-email @react-email/components @radix-ui/react-switch
```

**Version verification (confirmed 2026-03-21 against npm registry):**
- `resend`: 6.9.4
- `react-email`: 5.2.10
- `@react-email/components`: 1.0.10
- `@radix-ui/react-switch`: 1.2.6

---

## Architecture Patterns

### Recommended Project Structure (New Files)

```
src/
├── emails/
│   ├── layout/
│   │   └── base-layout.tsx      # Shared Html/Head/Body/Container wrapper
│   ├── booking-approved.tsx     # EMAIL-02 template (Phase 9 wires it)
│   ├── booking-rejected.tsx     # EMAIL-03 template (Phase 9 wires it)
│   ├── trial-expiry-3days.tsx   # TRIAL-02 template (Phase 10 wires it)
│   ├── trial-expiry-1day.tsx    # TRIAL-02 template (Phase 10 wires it)
│   └── trial-expired.tsx        # TRIAL-02 template (Phase 10 wires it)
├── lib/
│   └── email.ts                 # Resend singleton + sendEmail() utility
├── components/
│   ├── ui/
│   │   └── switch.tsx           # Radix UI Switch wrapper (shadcn/ui style)
│   └── dashboard/
│       └── email-preferences-form.tsx  # Client component with three toggles
└── app/
    └── api/
        └── settings/
            └── email-preferences/
                └── route.ts     # GET + PATCH handler
```

### Pattern 1: Resend Singleton with server-only Guard

**What:** `src/lib/email.ts` constructs a Resend instance at module load time and exports a `sendEmail()` function that wraps `resend.emails.send()`. The `server-only` import prevents accidental client-bundle inclusion. The file is the single caller of the Resend SDK — no route handler constructs Resend directly.

**When to use:** All email sends go through this utility. Phase 9 and Phase 10 will import `sendEmail` from here.

**Example:**
```typescript
// src/lib/email.ts
// Source: .planning/research/ARCHITECTURE.md — Singleton Lib Modules pattern
import 'server-only'
import { Resend } from 'resend'
import { env } from '@/env'

const resend = new Resend(env.RESEND_API_KEY)

export async function sendEmail(opts: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  const { error } = await resend.emails.send({
    from: `PriCal Notifications <${env.EMAIL_FROM}>`,
    ...opts,
  })
  if (error) throw new Error(`Email delivery failed: ${error.message}`)
}
```

Note: `env.RESEND_API_KEY` and `env.EMAIL_FROM` must be added to `src/env.ts` (both optional to preserve local dev startup without them).

### Pattern 2: React Email Template Component

**What:** Each template is a default-export React component in `src/emails/`. It receives typed props and returns a `<Html>` tree using `@react-email/components` primitives. A shared `BaseLayout` wraps common structure (doctype, fonts, background color). The component is passed directly to `sendEmail({ react: <BookingApproved ... /> })` — Resend renders it to HTML internally.

**When to use:** All five templates follow this exact structure.

**Example:**
```tsx
// src/emails/booking-approved.tsx
import { Html, Head, Body, Container, Text, Button, Hr, Section } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface BookingApprovedProps {
  inviteeName: string
  inviteeEmail: string
  eventTypeName: string
  eventTime: string
}

export default function BookingApproved({
  inviteeName,
  inviteeEmail,
  eventTypeName,
  eventTime,
}: BookingApprovedProps) {
  return (
    <BaseLayout preview={`New booking from ${inviteeName}`}>
      <Text>A new booking has been confirmed.</Text>
      {/* ... */}
    </BaseLayout>
  )
}
```

### Pattern 3: Settings API Route — GET + PATCH

**What:** Mirror the pattern in `src/app/api/settings/guest-check/route.ts`. Use `getCurrentUser()` for auth, Zod `safeParse` for body validation, `prisma.user.update` for persistence. Note: the existing guest-check route uses PUT (full replacement). The CONTEXT specifies PATCH for email-preferences (partial update is semantically correct for boolean toggles).

**Example:**
```typescript
// src/app/api/settings/email-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const patchSchema = z.object({
  emailApprovedBookings: z.boolean().optional(),
  emailRejectedBookings: z.boolean().optional(),
  emailTrialWarnings: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    emailApprovedBookings: user.emailApprovedBookings,
    emailRejectedBookings: user.emailRejectedBookings,
    emailTrialWarnings: user.emailTrialWarnings,
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  })

  return NextResponse.json({
    emailApprovedBookings: updated.emailApprovedBookings,
    emailRejectedBookings: updated.emailRejectedBookings,
    emailTrialWarnings: updated.emailTrialWarnings,
  })
}
```

### Pattern 4: Prisma Migration — Three Boolean Columns

**What:** Add three boolean fields to the User model with `@default(true)`. Also add `@@index([trialEndsAt])` as documented in architecture (needed for Phase 10 cron query efficiency — add it now in the same migration to avoid a second migration later).

**Prisma schema addition:**
```prisma
// Addition to User model in prisma/schema.prisma
emailApprovedBookings  Boolean  @default(true)
emailRejectedBookings  Boolean  @default(true)
emailTrialWarnings     Boolean  @default(true)

// index for Phase 10 cron query — add in this migration
@@index([trialEndsAt])
```

Migration command: `npx prisma migrate dev --name add-email-preferences`

### Pattern 5: Settings UI — Email Preferences Card

**What:** A `EmailPreferencesForm` client component (`'use client'`) placed in the settings page after the Guest Checking card. Uses three `Switch` toggles. Calls PATCH on toggle change (or via save button — save button pattern is more consistent with other settings cards). Uses `useToast` for confirmation feedback (established pattern in guest-check-form).

The settings page (`page.tsx`) is a Server Component. It loads user data via `getCurrentUser()` and passes initial values as props to `EmailPreferencesForm`, following the same pattern as `GuestCheckForm`.

**Settings page insertion point:**
```tsx
// After GuestCheckForm card, before CancelMessage card (D-05)
<Card>
  <CardHeader>
    <div className="flex items-center gap-2">
      <Bell className="h-5 w-5" />
      <CardTitle>Email Notifications</CardTitle>
    </div>
    <CardDescription>
      Choose which emails PriCal sends you.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <EmailPreferencesForm
      initialApproved={user.emailApprovedBookings}
      initialRejected={user.emailRejectedBookings}
      initialTrialWarnings={user.emailTrialWarnings}
    />
  </CardContent>
</Card>
```

### Pattern 6: Switch Component (New UI Primitive)

**What:** A `Switch` component in `src/components/ui/switch.tsx` using `@radix-ui/react-switch`, following the same shadcn/ui wrapper style as other UI components in the project.

**Example (shadcn/ui pattern consistent with existing project UI components):**
```tsx
// src/components/ui/switch.tsx
'use client'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<...>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className="..." />
  </SwitchPrimitives.Root>
))
```

### Pattern 7: env.ts Additions

**What:** Add `RESEND_API_KEY` and `EMAIL_FROM` to `src/env.ts`. Both marked optional (consistent with existing Sentry and PostHog env vars) so the app starts locally without them.

```typescript
// server section additions
RESEND_API_KEY: z.string().min(1).optional(),
EMAIL_FROM: z.string().email().optional(),

// runtimeEnv additions
RESEND_API_KEY: process.env.RESEND_API_KEY,
EMAIL_FROM: process.env.EMAIL_FROM,
```

### Anti-Patterns to Avoid

- **Do not throw on email send failure in PATCH endpoint**: The settings endpoint updates DB preferences — email sends are a separate concern. Never couple a settings save to an email delivery check.
- **Do not construct Resend outside `src/lib/email.ts`**: Only one file should know about the Resend SDK. This is the same pattern as `prisma.ts` and `stripe.ts`.
- **Do not import `email.ts` in client components**: `server-only` guard will cause a build error. The form component calls `/api/settings/email-preferences`, not `email.ts` directly.
- **Do not use `PUT` for email-preferences**: PATCH is correct here (partial update). The existing guest-check route uses PUT because it fully replaces all fields. Email preferences are independent booleans — PATCH is semantically accurate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML email rendering | String-interpolated HTML with `<table>` layouts | `react-email` + `@react-email/components` | Email clients (Outlook, Gmail, Apple Mail) have wildly inconsistent CSS support; react-email components handle the compatibility layer |
| Toggle/switch UI | Custom checkbox styled to look like a switch | `@radix-ui/react-switch` | Accessibility (keyboard navigation, ARIA role=switch, state management) is non-trivial; Radix handles it |
| Email validation on PATCH endpoint | Manual object key checks | `zod` `safeParse` with `.optional()` fields | Already the project standard; type-safe and consistent |
| Email from address construction | `process.env.EMAIL_FROM` inline in route handlers | `env.EMAIL_FROM` from `src/env.ts` | Validated at startup; consistent with project convention |

**Key insight:** React Email's value is not just convenience — it handles the table-based layout requirement for Outlook and inline CSS normalization that would require hundreds of lines of hand-maintained HTML.

---

## Common Pitfalls

### Pitfall 1: Resend Domain Not Verified — Emails Fail Silently

**What goes wrong:** Code completes, Resend API returns 200, emails never arrive. Resend requires DNS verification of the sending domain before real delivery works. `notifications@prical.io` will fail or land in spam until DNS records (TXT, DKIM, MX) are added and propagated (24-48h).

**Why it happens:** The API key works before domain verification — test sends via Resend's sandbox pass. But sends to external inboxes fail silently or are rejected.

**How to avoid:** Initiate Resend domain verification in the Resend dashboard at the very start of Plan 08-01, before writing code. During the 24-48h DNS propagation window, validate the sending utility using Resend's test mode (sends to `delivered@resend.dev` which confirms the API call works without requiring domain verification). Confirm delivery to a real inbox before declaring EMAIL-01 complete.

**Warning signs:** `resend.emails.send()` returns `{ data: { id: '...' }, error: null }` but no email arrives. Domain status in Resend dashboard shows "Pending" not "Verified".

### Pitfall 2: email.ts Omits Error Propagation — Failures Are Invisible

**What goes wrong:** A broad `try/catch` in `sendEmail()` returns `{ success: false }` without logging or rethrowing. Failed sends are invisible in logs and monitoring.

**How to avoid:** The `sendEmail()` utility should throw on error (as shown in the code example above). Callers that cannot afford to fail (webhook handlers in Phase 9) wrap `sendEmail()` in their own try/catch and log the error without rethrowing. This way the utility is always observable.

### Pitfall 3: Missing @@index([trialEndsAt]) — Deferred to Separate Migration

**What goes wrong:** The architecture research calls out that `@@index([trialEndsAt])` must be added for the Phase 10 cron query. If it is not added in Phase 8's migration, Phase 10 will require a second migration touching the User table, which adds complexity.

**How to avoid:** Add `@@index([trialEndsAt])` to the User model in the same Prisma migration as the email preference booleans. It is already documented in the architecture research. Zero additional effort now; avoids a second migration later.

### Pitfall 4: PATCH Endpoint Accepts Empty Object

**What goes wrong:** A PATCH to `/api/settings/email-preferences` with `{}` (empty body) returns 200 but does nothing. The user's client might misinterpret this as a successful save.

**How to avoid:** Add a Zod `.refine()` check requiring at least one field to be present (shown in the code example for Pattern 3). Empty object should return 400.

### Pitfall 5: Settings Page Becomes a Client Component

**What goes wrong:** `EmailPreferencesForm` needs `'use client'`. If it is not isolated in its own file and is instead inlined in `settings/page.tsx`, the entire page becomes a client component, losing Server Component data-loading benefits.

**How to avoid:** Follow the existing pattern: `page.tsx` stays a Server Component. `EmailPreferencesForm` is a separate file with `'use client'`. The page loads data with `getCurrentUser()` and passes initial values as props (same as `GuestCheckForm`).

### Pitfall 6: react-email Templates Not Tested for Render Errors

**What goes wrong:** A template with a missing prop or a conditional rendering edge case throws at send time (not at template definition time). The error surfaces in production, not in development.

**How to avoid:** Write a unit test for each template that calls `render(<TemplateComponent {...testProps} />)` from `@react-email/render` and asserts the output contains expected strings. This catches JSX errors, missing imports, and conditional rendering issues before production. The test pattern is the same as existing component tests.

---

## Code Examples

### Verified: sendEmail() Utility Pattern

```typescript
// src/lib/email.ts
// Source: .planning/research/ARCHITECTURE.md Pattern 2 — verified against Resend Next.js docs
import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendEmail(opts: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  const { error } = await resend.emails.send({
    from: 'PriCal Notifications <notifications@prical.io>',
    ...opts,
  })
  if (error) throw new Error(`Email delivery failed: ${error.message}`)
}
```

Production version should use `env.RESEND_API_KEY` and `env.EMAIL_FROM` from `src/env.ts` rather than direct `process.env` access.

### Verified: react-email Base Layout

```tsx
// src/emails/layout/base-layout.tsx
// Source: react-email official docs — https://react.email/docs/components/html
import { Html, Head, Body, Container, Font } from '@react-email/components'

interface BaseLayoutProps {
  preview?: string
  children: React.ReactNode
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={{ backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          {children}
        </Container>
      </Body>
    </Html>
  )
}
```

### Verified: Prisma Migration Command

```bash
# After editing prisma/schema.prisma to add the three boolean fields + index:
npx prisma migrate dev --name add-email-preferences
```

This generates a migration file in `prisma/migrations/` and applies it to the local dev database. The generated SQL will be:
```sql
ALTER TABLE "users" ADD COLUMN "emailApprovedBookings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "emailRejectedBookings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "emailTrialWarnings" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "users_trialEndsAt_idx" ON "users"("trialEndsAt");
```

### Verified: react-email render for Testing

```typescript
// In a test file, to assert template renders without error:
import { render } from '@react-email/render'
import BookingApproved from '../emails/booking-approved'

it('renders without error', async () => {
  const html = await render(<BookingApproved inviteeName="Alice" inviteeEmail="alice@example.com" eventTypeName="30 Min Call" eventTime="2026-04-01T10:00:00Z" />)
  expect(html).toContain('Alice')
  expect(html).toContain('alice@example.com')
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nodemailer + SMTP | Resend HTTP API + react-email | ~2022 (Resend launched) | No SMTP server to manage; React-native template authoring |
| Handlebars/Mustache HTML strings | React Email TSX components | ~2023 (react-email matured) | Type-safe props, component reuse, IDE support |
| Manual table-based HTML emails | `@react-email/components` abstractions | ~2023 | Compatibility handled by library, not hand-coded |
| PUT for all settings updates | PATCH for partial updates (REST standard) | Ongoing best practice | Correct semantics when only updating a subset of resource fields |

**Deprecated/outdated:**
- `nodemailer`: Designed for SMTP; adds operational complexity with no benefit on Vercel serverless. Do not use.
- String-interpolated HTML email templates: Unmaintainable; no type safety; avoid entirely.

---

## Open Questions

1. **Resend test domain vs. prical.io domain**
   - What we know: Resend provides `onboarding@resend.dev` as a test sender; real delivery requires domain verification
   - What's unclear: Whether `prical.io` DNS is accessible to the developer at plan start
   - Recommendation: Plan 08-01 should note this as a first-task action item (log into Resend dashboard, add DNS records immediately). If DNS is inaccessible, use `onboarding@resend.dev` sender during development and note the production switch.

2. **reply-to address**
   - What we know: CONTEXT.md leaves reply-to to Claude's discretion
   - What's unclear: Whether users should be able to reply to notification emails
   - Recommendation: Set `reply_to: undefined` (no reply-to) for notification emails — they are informational, not conversational. This is the standard pattern for transactional notifications (Stripe, Linear).

3. **Preview text / inbox snippet**
   - What we know: CONTEXT.md leaves this to Claude's discretion; `@react-email/components` provides `<Preview>` component
   - What's unclear: Whether the five templates need differentiated preview text
   - Recommendation: Add `<Preview>` to all templates. Keep it to one short sentence summarizing the notification.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.16 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/email.test.ts src/app/api/settings/email-preferences` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-01 | `sendEmail()` calls Resend SDK with correct from/to/subject/react args | unit | `npx vitest run src/lib/email.test.ts` | Wave 0 |
| EMAIL-01 | Each of 5 templates renders to HTML without throwing | unit | `npx vitest run src/emails` | Wave 0 |
| EMAIL-01 | `sendEmail()` throws when Resend returns an error | unit | `npx vitest run src/lib/email.test.ts` | Wave 0 |
| EMAIL-04 | GET `/api/settings/email-preferences` returns current boolean values | unit | `npx vitest run src/app/api/settings/email-preferences` | Wave 0 |
| EMAIL-04 | PATCH with valid body updates boolean fields and returns updated values | unit | `npx vitest run src/app/api/settings/email-preferences` | Wave 0 |
| EMAIL-04 | PATCH with empty body `{}` returns 400 | unit | `npx vitest run src/app/api/settings/email-preferences` | Wave 0 |
| EMAIL-04 | PATCH with invalid types (e.g., string instead of boolean) returns 400 | unit | `npx vitest run src/app/api/settings/email-preferences` | Wave 0 |
| EMAIL-04 | GET/PATCH return 401 when unauthenticated | unit | `npx vitest run src/app/api/settings/email-preferences` | Wave 0 |
| EMAIL-01 | Test email delivers to real inbox (Resend dashboard confirms delivery) | manual | N/A — manual verification in Resend dashboard | Manual |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/email.test.ts src/emails`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/email.test.ts` — covers EMAIL-01 sendEmail unit tests
- [ ] `src/emails/booking-approved.test.tsx` — render test
- [ ] `src/emails/booking-rejected.test.tsx` — render test
- [ ] `src/emails/trial-expiry-3days.test.tsx` — render test
- [ ] `src/emails/trial-expiry-1day.test.tsx` — render test
- [ ] `src/emails/trial-expired.test.tsx` — render test
- [ ] `src/app/api/settings/email-preferences/route.test.ts` — covers EMAIL-04 API tests

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — resend@6.9.4, react-email@5.2.10, package versions, Resend+React Email integration pattern
- `.planning/research/ARCHITECTURE.md` — email.ts singleton pattern, schema additions, settings API route, 5 template list, build order
- `.planning/research/PITFALLS.md` — Resend domain verification timing, email error propagation, codebase-specific pitfalls
- `src/app/api/settings/guest-check/route.ts` — canonical settings API pattern (getCurrentUser + Zod + prisma.update)
- `src/app/(dashboard)/dashboard/settings/page.tsx` — settings page layout, Card ordering, Server Component pattern
- `src/components/dashboard/guest-check-form.tsx` — client component form pattern, useToast confirmation
- `src/lib/logger.ts` — server-only guard pattern
- `src/env.ts` — env validation pattern (optional fields for external services)
- `prisma/schema.prisma` — User model current state, migration target
- npm registry: resend@6.9.4, react-email@5.2.10, @react-email/components@1.0.10, @radix-ui/react-switch@1.2.6 (verified 2026-03-21)

### Secondary (MEDIUM confidence)

- [Resend Next.js docs](https://resend.com/docs/send-with-nextjs) — sendEmail pattern
- [react-email component docs](https://react.email/docs/components/html) — BaseLayout structure

### Tertiary (LOW confidence)

None — all critical findings are backed by primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed against npm registry 2026-03-21
- Architecture: HIGH — patterns derived directly from existing codebase (guest-check route, settings page, logger.ts)
- Pitfalls: HIGH — validated against existing architecture research and codebase patterns
- Test map: HIGH — test patterns verified against existing test files (logger.test.ts)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable packages; Resend/react-email APIs unlikely to change)

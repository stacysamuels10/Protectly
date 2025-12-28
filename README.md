# PriCal - Protect Your Calendar

<p align="center">
  <img src="assets/giffinal.gif" alt="PriCal Demo" width="600">
</p>

<p align="center">
  <strong>Webhook-based access control for Calendly that automatically cancels unauthorized booking attempts.</strong>
  <br>
  Only meet with people who matter.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#testing">Testing</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-reference">API Reference</a>
</p>

---

## Features

- 🔒 **Allowlist Management** - Control who can book meetings with you
- ⚡ **Automatic Cancellation** - Unauthorized bookings are cancelled instantly
- 📊 **Activity Dashboard** - Track approved and rejected booking attempts
- 🎛️ **Guest Check Modes** - Flexible rules for handling meeting guests
- 💳 **Subscription Tiers** - Free, Pro, and Business plans
- 🎨 **Modern UI** - Clean, responsive design with dark mode support

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui |
| **Database** | PostgreSQL with Prisma ORM |
| **Auth** | Calendly OAuth 2.0 |
| **Payments** | Stripe |
| **Testing** | Vitest, React Testing Library, Playwright |
| **Deployment** | Vercel + Neon |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (we recommend [Neon](https://neon.tech))
- Calendly Developer Account
- Stripe Account (for payments)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/prical.git
cd prical
npm install
```

### 2. Set Up Environment Variables

```bash
cp env.example .env.local
```

Fill in your environment variables (see [Environment Variables](#environment-variables) section below).

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/prical?sslmode=require"

# Calendly OAuth
CALENDLY_CLIENT_ID="your_calendly_client_id"
CALENDLY_CLIENT_SECRET="your_calendly_client_secret"
CALENDLY_REDIRECT_URI="http://localhost:3000/api/auth/calendly/callback"
CALENDLY_WEBHOOK_SIGNING_KEY="your_webhook_signing_key"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WEBHOOK_URL="http://localhost:3000/api/webhooks/calendly"

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET="your_session_secret_at_least_32_characters_long"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRICE_PRO_MONTHLY="price_..."
STRIPE_PRICE_PRO_YEARLY="price_..."
STRIPE_PRICE_BUSINESS_MONTHLY="price_..."
STRIPE_PRICE_BUSINESS_YEARLY="price_..."

# Environment
NODE_ENV="development"
```

### Setting Up Calendly OAuth

1. Go to [Calendly Developer Portal](https://developer.calendly.com)
2. Create a new OAuth application
3. Set the redirect URI to `http://localhost:3000/api/auth/calendly/callback`
4. Copy the Client ID and Client Secret to your `.env.local` file

### Setting Up Stripe

1. Create products and prices in Stripe Dashboard for Pro and Business tiers
2. Copy the price IDs to your `.env.local` file
3. Set up a webhook endpoint pointing to `/api/webhooks/stripe`
4. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

---

## Testing

PriCal has a comprehensive testing setup with both unit/component tests and end-to-end tests.

### Unit & Component Tests (Vitest)

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI)
npm run test:run

# Open interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**Test coverage includes:**
- Utility functions (`src/lib/utils.ts`)
- UI components (`src/components/ui/`)
- Form validation logic

### End-to-End Tests (Playwright)

```bash
# Run all E2E tests
npm run e2e

# Open interactive Playwright UI
npm run e2e:ui

# Run with visible browser
npm run e2e:headed

# View HTML test report
npm run e2e:report
```

**E2E test coverage includes:**
- Landing page functionality
- Navigation and routing
- OAuth flow initiation
- Responsive design
- Protected route redirects

### Running All Tests

```bash
# Run both unit and E2E tests
npm run test:run && npm run e2e
```

### Writing Tests

- **Unit tests**: Add `*.test.ts` files next to the code being tested
- **Component tests**: Add `*.test.tsx` files next to components
- **E2E tests**: Add `*.spec.ts` files in the `e2e/` directory

See [CONTRIBUTING.md](CONTRIBUTING.md) for testing guidelines.

---

## Project Structure

```
prical/
├── e2e/                      # End-to-end tests (Playwright)
│   ├── landing-page.spec.ts
│   └── dashboard.spec.ts
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── src/
│   ├── app/
│   │   ├── (dashboard)/      # Dashboard pages (protected)
│   │   │   └── dashboard/
│   │   │       ├── activity/ # Activity log
│   │   │       ├── allowlist/# Allowlist management
│   │   │       └── settings/ # User settings
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Authentication
│   │   │   ├── allowlists/   # Allowlist CRUD
│   │   │   ├── billing/      # Stripe integration
│   │   │   ├── dashboard/    # Dashboard data
│   │   │   ├── settings/     # User settings
│   │   │   └── webhooks/     # Webhook handlers
│   │   ├── globals.css       # Global styles
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── components/
│   │   ├── dashboard/        # Dashboard-specific components
│   │   ├── providers/        # React context providers
│   │   └── ui/               # Reusable UI components (shadcn)
│   ├── lib/
│   │   ├── calendly.ts       # Calendly API utilities
│   │   ├── prisma.ts         # Database client
│   │   ├── session.ts        # Session management
│   │   ├── stripe.ts         # Stripe utilities
│   │   ├── utils.ts          # Helper functions
│   │   └── webhook.ts        # Webhook utilities
│   └── test/
│       └── setup.ts          # Test configuration
├── playwright.config.ts      # Playwright config
├── vitest.config.ts          # Vitest config
├── tailwind.config.ts        # Tailwind config
└── tsconfig.json             # TypeScript config
```

---

## Subscription Tiers

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Allowlist entries | 25 | 500 | 2,000 |
| Event types | 1 | Unlimited | Unlimited |
| Activity log | 30 days | 90 days | 365 days |
| Email templates | 1 | 5 | Unlimited |
| Per-event allowlists | ❌ | ✅ | ✅ |
| CSV import | ❌ | ✅ | ✅ |
| **Price** | **$0** | **$9/mo** | **$29/mo** |

---

## Guest Check Modes

PriCal offers flexible rules for handling meeting guests:

| Mode | Description |
|------|-------------|
| **Strict** | All participants (invitee + guests) must be on allowlist |
| **Primary Only** | Only check the scheduling invitee, allow any guests |
| **Any Approved** | Allow if ANY participant is on the allowlist |
| **No Guests** | Approved invitee only, no additional guests allowed |
| **Allow All** | Allow all meetings (protection disabled) |

---

## API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/calendly` | GET | Start OAuth flow |
| `/api/auth/calendly/callback` | GET | OAuth callback |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/me` | GET | Get current user |

### Allowlist Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/allowlists` | GET | List all allowlists |
| `/api/allowlists/:id/entries` | GET | List entries in allowlist |
| `/api/allowlists/:id/entries` | POST | Add entries to allowlist |
| `/api/allowlists/:id/entries/:entryId` | DELETE | Remove entry |

### Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/stats` | GET | Get dashboard statistics |
| `/api/dashboard/activity` | GET | Get activity log |

### Settings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/cancel-message` | GET | Get cancellation message |
| `/api/settings/cancel-message` | PUT | Update cancellation message |
| `/api/settings/guest-check` | GET | Get guest check settings |
| `/api/settings/guest-check` | PUT | Update guest check settings |
| `/api/settings/account` | DELETE | Delete account |

### Billing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/billing/checkout` | POST | Create Stripe checkout session |
| `/api/billing/portal` | POST | Open Stripe billing portal |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/calendly` | POST | Handle Calendly events |
| `/api/webhooks/stripe` | POST | Handle Stripe events |

---

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add all environment variables
4. Deploy!

### Database (Neon)

1. Create a new project at [Neon](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`
3. Run `npm run db:migrate:deploy` to run migrations

### Production Checklist

- [ ] Update `CALENDLY_REDIRECT_URI` to production domain
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Update `WEBHOOK_URL` to production webhook endpoint
- [ ] Configure Stripe webhook endpoint for production
- [ ] Set `NODE_ENV=production`
- [ ] Generate a secure `SESSION_SECRET`
- [ ] Enable Calendly webhook signing verification

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npm test` | Run unit tests in watch mode |
| `npm run test:run` | Run unit tests once |
| `npm run test:coverage` | Generate test coverage report |
| `npm run e2e` | Run E2E tests |
| `npm run e2e:ui` | Open Playwright UI |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test:run && npm run e2e`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

## API Documentation

PriCal includes interactive API documentation powered by OpenAPI/Swagger.

### Accessing the Docs

- **Interactive UI**: Visit `/docs` in your browser (e.g., `http://localhost:3000/docs`)
- **OpenAPI JSON**: Available at `/api/docs`

The documentation includes:
- All API endpoints with request/response schemas
- Authentication requirements
- Try-it-out functionality for testing endpoints
- Schema definitions for all data types

### Features

- 📋 **Complete API Reference** - All endpoints documented with examples
- 🔐 **Authentication Info** - Clear auth requirements for each endpoint
- 🧪 **Try It Out** - Test endpoints directly from the docs
- 📊 **Schema Definitions** - Full data model documentation

---

## Support

- 📧 Email: support@prical.io
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/prical/issues)
- 📖 Docs: [Documentation](https://docs.prical.io)
- 📚 API Docs: [API Reference](/docs)

---

<p align="center">
  Built with ❤️ by the PriCal team
</p>

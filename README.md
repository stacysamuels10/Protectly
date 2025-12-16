# PriCal - Protect Your Calendar

PriCal is a webhook-based access control system for Calendly that automatically cancels unauthorized booking attempts. Only meet with people who matter.

## Features

- 🔒 **Allowlist Management** - Control who can book meetings with you
- ⚡ **Automatic Cancellation** - Unauthorized bookings are cancelled instantly
- 📊 **Activity Dashboard** - Track approved and rejected booking attempts
- 💳 **Subscription Tiers** - Free, Pro, and Business plans
- 🎨 **Modern UI** - Clean, responsive design

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Direct Calendly OAuth
- **Payments**: Stripe
- **Deployment**: Vercel (frontend) + Neon (database)

## Getting Started

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

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Calendly OAuth
CALENDLY_CLIENT_ID="your_client_id"
CALENDLY_CLIENT_SECRET="your_client_secret"
CALENDLY_REDIRECT_URI="http://localhost:3000/api/auth/calendly/callback"
CALENDLY_WEBHOOK_SIGNING_KEY="your_webhook_signing_key"

# App URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WEBHOOK_URL="http://localhost:3000/api/webhooks/calendly"

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET="your_session_secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRICE_PRO_MONTHLY="price_..."
STRIPE_PRICE_PRO_YEARLY="price_..."
STRIPE_PRICE_BUSINESS_MONTHLY="price_..."
STRIPE_PRICE_BUSINESS_YEARLY="price_..."
```

### 3. Set Up Calendly OAuth

1. Go to [Calendly Developer Portal](https://developer.calendly.com)
2. Create a new OAuth application
3. Set the redirect URI to `http://localhost:3000/api/auth/calendly/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### 4. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Run migrations
npm run db:migrate
```

### 5. Set Up Stripe

1. Create products and prices in Stripe Dashboard for Pro and Business tiers
2. Copy the price IDs to your `.env` file
3. Set up a webhook endpoint pointing to `/api/webhooks/stripe`
4. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add all environment variables
4. Deploy!

### Database (Neon)

1. Create a new project at [Neon](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`
3. Run `npm run db:push` to create tables

### Webhooks

For production, update these URLs:
- `CALENDLY_REDIRECT_URI` to your production domain
- `WEBHOOK_URL` to your production webhook endpoint
- Stripe webhook endpoint to your production domain

## Project Structure

```
prical/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/
│   │   ├── (dashboard)/   # Dashboard pages
│   │   ├── api/           # API routes
│   │   └── page.tsx       # Landing page
│   ├── components/
│   │   ├── dashboard/     # Dashboard components
│   │   └── ui/            # UI components (shadcn)
│   └── lib/
│       ├── calendly.ts    # Calendly API utilities
│       ├── prisma.ts      # Database client
│       ├── session.ts     # Session management
│       ├── stripe.ts      # Stripe utilities
│       └── utils.ts       # Helper functions
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Subscription Tiers

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Allowlist entries | 25 | 500 | 2,000 |
| Event types | 1 | Unlimited | Unlimited |
| Activity log | 30 days | 90 days | 365 days |
| CSV import | ❌ | ✅ | ✅ |
| Price | $0 | $9/mo | $29/mo |

## API Endpoints

### Authentication
- `GET /api/auth/calendly` - Start OAuth flow
- `GET /api/auth/calendly/callback` - OAuth callback
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Allowlist
- `GET /api/allowlists` - List allowlists
- `GET /api/allowlists/:id/entries` - List entries
- `POST /api/allowlists/:id/entries` - Add entries
- `DELETE /api/allowlists/:id/entries/:entryId` - Remove entry

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/activity` - Get activity log

### Settings
- `GET /api/settings/cancel-message` - Get cancel message
- `PUT /api/settings/cancel-message` - Update cancel message
- `DELETE /api/settings/account` - Delete account

### Billing
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Open billing portal

### Webhooks
- `POST /api/webhooks/calendly` - Calendly webhook handler
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support, email support@prical.io or open an issue on GitHub.

---

Built with ❤️ by the PriCal team

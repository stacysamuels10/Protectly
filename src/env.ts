// src/env.ts
// Single source of truth for all environment variables.
// Validated at module load time using @t3-oss/env-nextjs + zod.
// Any missing required variable causes an immediate startup failure
// with a clear error message BEFORE any request handler runs.
//
// IMPORTANT: This file must NOT import from any src/lib/*.ts file.
// It is a leaf module — only @t3-oss/env-nextjs and zod are allowed as imports.

import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  /**
   * Server-side environment variables.
   * These are NEVER exposed to the browser.
   */
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // Session — ENV-02: fail fast if absent or shorter than 32 chars.
    // NO .default(), NO .optional() — intentional.
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters'),

    // Encryption key for OAuth token storage (AES-256-GCM, 32 bytes = 64 hex chars).
    // NO .default(), NO .optional() — intentional.
    ENCRYPTION_KEY: z
      .string()
      .length(64, 'ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)')
      .regex(
        /^[0-9a-f]+$/,
        'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
      ),

    // Calendly OAuth credentials
    CALENDLY_CLIENT_ID: z.string().min(1),
    CALENDLY_CLIENT_SECRET: z.string().min(1),
    CALENDLY_REDIRECT_URI: z.string().url(),

    // Calendly webhook signing key.
    // NO .default(), NO .optional() — removes the conditional bypass security gap
    // in src/app/api/webhooks/calendly/route.ts. App refuses to start without it.
    CALENDLY_WEBHOOK_SIGNING_KEY: z.string().min(1),

    // Stripe secret credentials
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

    // Stripe price IDs for subscription plans
    STRIPE_PRICE_PRO_MONTHLY: z.string().startsWith('price_'),
    STRIPE_PRICE_PRO_YEARLY: z.string().startsWith('price_'),
    STRIPE_PRICE_BUSINESS_MONTHLY: z.string().startsWith('price_'),
    STRIPE_PRICE_BUSINESS_YEARLY: z.string().startsWith('price_'),

    // Upstash Redis — optional; when absent, rate limiting degrades gracefully (all checks pass)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    // Sentry — optional so app starts without them locally and in test environments
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),

    // Node environment — only key with a default; safe for NODE_ENV
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  },

  /**
   * Client-side environment variables.
   * These are exposed to the browser and MUST be prefixed with NEXT_PUBLIC_.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },

  /**
   * Explicit runtime env mapping.
   * Required by @t3-oss/env-nextjs — cannot read process.env automatically
   * due to Next.js static analysis. Every key in server/client MUST appear here.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
    CALENDLY_REDIRECT_URI: process.env.CALENDLY_REDIRECT_URI,
    CALENDLY_WEBHOOK_SIGNING_KEY: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_YEARLY: process.env.STRIPE_PRICE_PRO_YEARLY,
    STRIPE_PRICE_BUSINESS_MONTHLY: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    STRIPE_PRICE_BUSINESS_YEARLY: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  },
})

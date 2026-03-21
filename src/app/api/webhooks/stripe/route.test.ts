import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/logger to silence log output in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
  },
}))

// Mock @/env before any imports
vi.mock('@/env', () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  },
}))

// Mock @/lib/stripe -- constructEvent is the critical method
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  mapStripeStatus: vi.fn((status: string) => status.toUpperCase()),
}))

// Mock @/lib/prisma -- all Prisma methods used by the handler
vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: {
      create: vi.fn(),
    },
    user: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { POST } from './route'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent)
const mockProcessedWebhookEvent = vi.mocked(prisma.processedWebhookEvent)
const mockUserUpdate = vi.mocked(prisma.user.update)
const mockUserFindFirst = vi.mocked(prisma.user.findFirst)

// Helper: build a Stripe event object
function makeStripeEvent(type: string, data: Record<string, unknown>, id = 'evt_test_123') {
  return { id, type, data: { object: data } }
}

// Helper: build a NextRequest-compatible mock
function makeStripeRequest(body = '{}', sig: string | null = 'valid-sig') {
  return {
    text: async () => body,
    headers: {
      get: (n: string) => (n === 'stripe-signature' ? sig : null),
    },
  } as any
}

describe('Stripe Webhook POST handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProcessedWebhookEvent.create.mockResolvedValue({} as any)
    mockUserUpdate.mockResolvedValue({} as any)
  })

  it('handles checkout.session.completed -- updates user to PRO with subscription', async () => {
    const event = makeStripeEvent('checkout.session.completed', {
      metadata: { userId: 'user-1', tier: 'PRO' },
      subscription: 'sub_123',
      customer: 'cus_123',
    })
    mockConstructEvent.mockReturnValue(event as any)

    const response = await POST(makeStripeRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ received: true })

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        subscriptionTier: 'PRO',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
      },
    })
  })

  it('handles customer.subscription.deleted -- resets user to FREE/CANCELED', async () => {
    const event = makeStripeEvent('customer.subscription.deleted', {
      metadata: { userId: 'user-1' },
      status: 'canceled',
    })
    mockConstructEvent.mockReturnValue(event as any)

    const response = await POST(makeStripeRequest())

    expect(response.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        subscriptionTier: 'FREE',
        subscriptionStatus: 'CANCELED',
        stripeSubscriptionId: null,
      },
    })
  })

  it('handles invoice.payment_failed -- sets user to PAST_DUE', async () => {
    const event = makeStripeEvent('invoice.payment_failed', {
      subscription: 'sub_123',
    })
    mockConstructEvent.mockReturnValue(event as any)
    mockUserFindFirst.mockResolvedValue({ id: 'user-1' } as any)

    const response = await POST(makeStripeRequest())

    expect(response.status).toBe(200)
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
    })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        subscriptionStatus: 'PAST_DUE',
      },
    })
  })

  it('returns 200 without processing when event is a duplicate (P2002)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.7.1',
    })
    mockProcessedWebhookEvent.create.mockRejectedValueOnce(p2002)

    const event = makeStripeEvent('checkout.session.completed', {
      metadata: { userId: 'user-1', tier: 'PRO' },
      subscription: 'sub_123',
      customer: 'cus_123',
    })
    mockConstructEvent.mockReturnValue(event as any)

    const response = await POST(makeStripeRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ received: true })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const response = await POST(makeStripeRequest('{}', null))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'No signature' })
  })

  it('returns 400 when constructEvent throws (invalid signature)', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const response = await POST(makeStripeRequest())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Invalid signature' })
  })
})

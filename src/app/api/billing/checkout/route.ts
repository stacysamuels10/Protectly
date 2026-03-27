import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { createCheckoutSession, type PaidTier, type SubscriptionInterval } from '@/lib/stripe'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getPostHogServer } from '@/lib/posthog-server'

const checkoutSchema = z.object({
  tier: z.enum(['PRO', 'BUSINESS']),
  interval: z.enum(['monthly', 'yearly']),
})

/**
 * @swagger
 * /api/billing/checkout:
 *   post:
 *     summary: Create checkout session
 *     description: Creates a Stripe checkout session for upgrading to a paid plan
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tier
 *               - interval
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [PRO, BUSINESS]
 *                 description: The subscription tier to purchase
 *               interval:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 description: Billing interval
 *     responses:
 *       200:
 *         description: Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe checkout URL to redirect user to
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Failed to create checkout session
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = checkoutSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { tier, interval } = parsed.data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await createCheckoutSession(
      user.id,
      user.email,
      tier as PaidTier,
      interval as SubscriptionInterval,
      `${appUrl}/dashboard/settings?success=true`,
      `${appUrl}/dashboard/settings?canceled=true`
    )

    const ph = getPostHogServer()
    ph?.capture({ distinctId: user.id, event: 'upgrade_click', properties: { plan: tier, interval } })
    if (ph) await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error({ err: error, action: 'create_checkout' }, 'failed to create checkout session')
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}



import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { createCustomerPortalSession } from '@/lib/stripe'

/**
 * @swagger
 * /api/billing/portal:
 *   post:
 *     summary: Open billing portal
 *     description: Creates a Stripe customer portal session for managing subscription and payment methods
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: Portal session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 *                   description: Stripe customer portal URL
 *       400:
 *         description: No billing account found (user has never subscribed)
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Failed to create portal session
 */
export async function POST() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the full user with Stripe customer ID
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  })

  if (!fullUser?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const session = await createCustomerPortalSession(
      fullUser.stripeCustomerId,
      `${appUrl}/dashboard/settings`
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Failed to create portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}



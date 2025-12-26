import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { createCheckoutSession, type PaidTier, type SubscriptionInterval } from '@/lib/stripe'
import { z } from 'zod'

const checkoutSchema = z.object({
  tier: z.enum(['PRO', 'BUSINESS']),
  interval: z.enum(['monthly', 'yearly']),
})

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

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Failed to create checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}



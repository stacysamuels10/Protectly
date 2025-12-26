import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { createCustomerPortalSession } from '@/lib/stripe'

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



import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const SUBSCRIPTION_PRICES = {
  PRO: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  BUSINESS: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY!,
  },
} as const

export type SubscriptionInterval = 'monthly' | 'yearly'
export type PaidTier = 'PRO' | 'BUSINESS'

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  tier: PaidTier,
  interval: SubscriptionInterval,
  successUrl: string,
  cancelUrl: string
) {
  const priceId = SUBSCRIPTION_PRICES[tier][interval]

  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      tier,
    },
    subscription_data: {
      metadata: {
        userId,
        tier,
      },
    },
  })

  return session
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId)
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId)
}

// Map Stripe subscription status to our status
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE'
    case 'trialing':
      return 'TRIALING'
    case 'past_due':
      return 'PAST_DUE'
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED'
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'UNPAID'
    default:
      return 'ACTIVE'
  }
}


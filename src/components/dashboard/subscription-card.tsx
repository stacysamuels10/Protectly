'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { CreditCard, Loader2, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface SubscriptionCardProps {
  user: {
    subscriptionTier: string
    subscriptionStatus: string
    trialEndsAt: Date | null
  }
}

export function SubscriptionCard({ user }: SubscriptionCardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const { toast } = useToast()

  const handleUpgrade = async (tier: 'PRO' | 'BUSINESS', interval: 'monthly' | 'yearly') => {
    setLoading(`${tier}-${interval}`)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start checkout. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setLoading('portal')

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      window.location.href = data.url
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open billing portal. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const isTrialing = user.subscriptionStatus === 'TRIALING'
  const isFree = user.subscriptionTier === 'FREE'
  const isPaid = ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(user.subscriptionTier)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>Subscription</CardTitle>
        </div>
        <CardDescription>
          Manage your subscription and billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{user.subscriptionTier} Plan</span>
              {isTrialing && <Badge variant="warning">Trial</Badge>}
              {user.subscriptionStatus === 'PAST_DUE' && (
                <Badge variant="error">Past Due</Badge>
              )}
            </div>
            {isTrialing && user.trialEndsAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Trial ends {formatDate(user.trialEndsAt)}
              </p>
            )}
          </div>
          {isPaid && !isTrialing && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={loading === 'portal'}
            >
              {loading === 'portal' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage Billing
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Upgrade Options */}
        {(isFree || isTrialing) && (
          <div className="space-y-4">
            <h4 className="font-medium">Upgrade Your Plan</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Pro Plan */}
              <div className="border rounded-lg p-4 space-y-4">
                <div>
                  <h5 className="font-semibold">Pro</h5>
                  <p className="text-sm text-muted-foreground">
                    500 emails, unlimited events
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade('PRO', 'monthly')}
                    disabled={loading !== null}
                  >
                    {loading === 'PRO-monthly' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    $9/month
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleUpgrade('PRO', 'yearly')}
                    disabled={loading !== null}
                  >
                    {loading === 'PRO-yearly' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    $90/year (save 17%)
                  </Button>
                </div>
              </div>

              {/* Business Plan */}
              <div className="border rounded-lg p-4 space-y-4 border-primary">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-semibold">Business</h5>
                    <Badge>Popular</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    2,000 emails, team features
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade('BUSINESS', 'monthly')}
                    disabled={loading !== null}
                  >
                    {loading === 'BUSINESS-monthly' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    $29/month
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleUpgrade('BUSINESS', 'yearly')}
                    disabled={loading !== null}
                  >
                    {loading === 'BUSINESS-yearly' && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    $290/year (save 17%)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


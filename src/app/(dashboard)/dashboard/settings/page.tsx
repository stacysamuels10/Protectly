import { getCurrentUser } from '@/lib/session'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TIER_LIMITS } from '@/lib/utils'
import { CancelMessageForm } from '@/components/dashboard/cancel-message-form'
import { GuestCheckForm } from '@/components/dashboard/guest-check-form'
import { SubscriptionCard } from '@/components/dashboard/subscription-card'
import { DeleteAccountButton } from '@/components/dashboard/delete-account-button'
import { Settings, CreditCard, MessageSquare, Trash2, Users } from 'lucide-react'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const tierLimits = TIER_LIMITS[user.subscriptionTier]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and subscription.
        </p>
      </div>

      {/* Subscription */}
      <SubscriptionCard user={user} />

      {/* Guest Checking */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Guest Checking</CardTitle>
          </div>
          <CardDescription>
            Control how meeting guests are validated against your allowlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuestCheckForm 
            initialMode={user.guestCheckMode} 
            initialMessage={user.guestCancelMessage} 
          />
        </CardContent>
      </Card>

      {/* Cancel Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Cancellation Message</CardTitle>
          </div>
          <CardDescription>
            Customize the message sent when the booking invitee is not on your allowlist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CancelMessageForm initialMessage={user.cancelMessage} />
        </CardContent>
      </Card>

      {/* Plan Features */}
      <Card>
        <CardHeader>
          <CardTitle>Your Plan Features</CardTitle>
          <CardDescription>
            Current features available on your {user.subscriptionTier} plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Allowlist entries</span>
              <Badge variant="secondary">
                {tierLimits.allowlistEntries === Infinity ? 'Unlimited' : tierLimits.allowlistEntries}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Event types</span>
              <Badge variant="secondary">
                {tierLimits.eventTypes === Infinity ? 'Unlimited' : tierLimits.eventTypes}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>Activity log retention</span>
              <Badge variant="secondary">
                {tierLimits.activityLogDays === Infinity ? 'Unlimited' : `${tierLimits.activityLogDays} days`}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span>CSV import</span>
              <Badge variant={tierLimits.csvImport ? 'success' : 'secondary'}>
                {tierLimits.csvImport ? 'Available' : 'Not available'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            <CardTitle>Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountButton />
        </CardContent>
      </Card>
    </div>
  )
}


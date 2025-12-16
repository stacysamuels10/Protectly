import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TIER_LIMITS } from '@/lib/utils'
import { AllowlistTable } from '@/components/dashboard/allowlist-table'
import { AddEmailDialog } from '@/components/dashboard/add-email-dialog'
import { Users } from 'lucide-react'

async function getAllowlistData(userId: string) {
  const allowlist = await prisma.allowlist.findFirst({
    where: { userId, isGlobal: true },
    include: {
      entries: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { entries: true },
      },
    },
  })

  return allowlist
}

export default async function AllowlistPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const allowlist = await getAllowlistData(user.id)
  const tierLimits = TIER_LIMITS[user.subscriptionTier]

  if (!allowlist) {
    return (
      <div className="text-center py-12">
        <p>No allowlist found. Please contact support.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Allowlist</h1>
          <p className="text-muted-foreground">
            Manage the email addresses that can book meetings with you.
          </p>
        </div>
        <AddEmailDialog allowlistId={allowlist.id} />
      </div>

      {/* Usage Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {allowlist._count.entries} / {tierLimits.allowlistEntries === Infinity ? '∞' : tierLimits.allowlistEntries} emails
                </p>
                <p className="text-sm text-muted-foreground">
                  {user.subscriptionTier} plan limit
                </p>
              </div>
            </div>
            {tierLimits.allowlistEntries !== Infinity && 
             allowlist._count.entries >= tierLimits.allowlistEntries * 0.9 && (
              <Badge variant="warning">Near limit</Badge>
            )}
          </div>
          {tierLimits.allowlistEntries !== Infinity && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ 
                    width: `${Math.min(100, (allowlist._count.entries / tierLimits.allowlistEntries) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allowlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <AllowlistTable 
            entries={allowlist.entries} 
            allowlistId={allowlist.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}


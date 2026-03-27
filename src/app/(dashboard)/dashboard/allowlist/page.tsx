import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TIER_LIMITS } from '@/lib/utils'
import { AllowlistTable } from '@/components/dashboard/allowlist-table'
import { AddEmailDialog } from '@/components/dashboard/add-email-dialog'
import { CsvExportButton } from '@/components/dashboard/csv-export-button'
import { CsvImportButton } from '@/components/dashboard/csv-import-button'
import { AddDomainDialog } from '@/components/dashboard/add-domain-dialog'
import { DomainAllowlistSection } from '@/components/dashboard/domain-allowlist-section'
import { Users, Globe } from 'lucide-react'

async function getAllowlistData(userId: string) {
  const allowlist = await prisma.allowlist.findFirst({
    where: { userId, isGlobal: true },
    include: {
      entries: {
        orderBy: { createdAt: 'desc' },
      },
      domainEntries: { orderBy: { createdAt: 'desc' } },
      _count: {
        select: { entries: true, domainEntries: true },
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
            Manage the emails and domains that can book meetings with you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvImportButton allowlistId={allowlist.id} subscriptionTier={user.subscriptionTier} />
          <CsvExportButton allowlistId={allowlist.id} />
          <AddEmailDialog allowlistId={allowlist.id} />
          <AddDomainDialog allowlistId={allowlist.id} />
        </div>
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

          {/* Domain usage row */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {allowlist._count.domainEntries} / {tierLimits.domainEntries === Infinity ? '∞' : tierLimits.domainEntries} domains
                </p>
                <p className="text-sm text-muted-foreground">
                  {user.subscriptionTier} plan limit
                </p>
              </div>
            </div>
            {tierLimits.domainEntries !== Infinity &&
             allowlist._count.domainEntries >= tierLimits.domainEntries * 0.9 && (
              <Badge variant="warning">Near limit</Badge>
            )}
          </div>
          {tierLimits.domainEntries !== Infinity && (
            <div className="mt-4">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (allowlist._count.domainEntries / tierLimits.domainEntries) * 100)}%`
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

      {/* Domain Allowlist Section */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Domains</CardTitle>
          <p className="text-sm text-muted-foreground">
            Domains allow all bookings from that email domain.
          </p>
        </CardHeader>
        <CardContent>
          <DomainAllowlistSection
            domainEntries={allowlist.domainEntries}
            allowlistId={allowlist.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}

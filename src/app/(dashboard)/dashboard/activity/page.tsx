import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TIER_LIMITS, formatDateTime } from '@/lib/utils'
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { subDays } from 'date-fns'

async function getActivityData(userId: string, tier: string) {
  const tierLimits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS]
  const retentionDays = tierLimits.activityLogDays === Infinity ? 365 : tierLimits.activityLogDays
  const cutoffDate = subDays(new Date(), retentionDays)

  const [attempts, counts] = await Promise.all([
    prisma.bookingAttempt.findMany({
      where: {
        userId,
        createdAt: { gte: cutoffDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        eventType: { select: { name: true } },
      },
    }),
    prisma.bookingAttempt.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: cutoffDate },
      },
      _count: true,
    }),
  ])

  const statusCounts = {
    APPROVED: 0,
    REJECTED: 0,
    RATE_LIMITED: 0,
  }

  counts.forEach((c) => {
    statusCounts[c.status] = c._count
  })

  return { attempts, statusCounts, retentionDays }
}

export default async function ActivityPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const { attempts, statusCounts, retentionDays } = await getActivityData(
    user.id,
    user.subscriptionTier
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">
          View all booking attempts from the last {retentionDays} days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-light">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.APPROVED}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-light">
                <XCircle className="h-5 w-5 text-error" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.REJECTED}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.RATE_LIMITED}</p>
                <p className="text-sm text-muted-foreground">Rate Limited</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
              <p className="text-muted-foreground">
                When someone tries to book a meeting, you&apos;ll see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        attempt.status === 'APPROVED'
                          ? 'success'
                          : attempt.status === 'REJECTED'
                          ? 'error'
                          : 'warning'
                      }
                    >
                      {attempt.status === 'APPROVED'
                        ? 'Approved'
                        : attempt.status === 'REJECTED'
                        ? 'Rejected'
                        : 'Rate Limited'}
                    </Badge>
                    <div>
                      <p className="font-medium">{attempt.inviteeEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        {attempt.inviteeName && `${attempt.inviteeName} · `}
                        {attempt.eventType?.name || 'Unknown Event'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(attempt.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


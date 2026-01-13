import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar,
  Plus,
  ArrowRight
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { AddEmailDialog } from '@/components/dashboard/add-email-dialog'

async function getDashboardStats(userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [totalBookings, approvedBookings, rejectedBookings, allowlistSize, recentAttempts, allowlist] = await Promise.all([
    prisma.bookingAttempt.count({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.bookingAttempt.count({
      where: { userId, status: 'APPROVED', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.bookingAttempt.count({
      where: { userId, status: 'REJECTED', createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.allowlistEntry.count({
      where: { allowlist: { userId } },
    }),
    prisma.bookingAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { eventType: { select: { name: true } } },
    }),
    prisma.allowlist.findFirst({
      where: { userId, isGlobal: true },
      select: { id: true },
    }),
  ])

  return {
    totalBookings,
    approvedBookings,
    rejectedBookings,
    allowlistSize,
    recentAttempts,
    allowlistId: allowlist?.id,
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }

  const stats = await getDashboardStats(user.id)

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your calendar protection.
          </p>
        </div>
        {stats.allowlistId && (
          <AddEmailDialog allowlistId={stats.allowlistId} />
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approvedBookings}</div>
            <p className="text-xs text-muted-foreground">Meetings allowed</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-error" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-error">{stats.rejectedBookings}</div>
            <p className="text-xs text-muted-foreground">Meetings cancelled</p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allowlist Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.allowlistSize}</div>
            <p className="text-xs text-muted-foreground">Approved emails</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link href="/dashboard/activity">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentAttempts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No booking attempts yet.</p>
              <p className="text-sm">
                When someone tries to book a meeting, you&apos;ll see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={attempt.status === 'APPROVED' ? 'success' : 'error'}
                    >
                      {attempt.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </Badge>
                    <div>
                      <p className="font-medium">{attempt.inviteeEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        {attempt.eventType?.name || 'Unknown Event'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatRelativeTime(attempt.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {stats.allowlistSize === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-muted-foreground mb-4">
              Add your first approved email to start protecting your calendar.
            </p>
            {stats.allowlistId && (
              <AddEmailDialog allowlistId={stats.allowlistId} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}




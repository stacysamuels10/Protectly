import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { TIER_LIMITS } from '@/lib/utils'
import { subDays, startOfDay, format } from 'date-fns'

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tierLimits = TIER_LIMITS[user.subscriptionTier]
  const retentionDays = tierLimits.activityLogDays === Infinity ? 365 : tierLimits.activityLogDays
  const cutoffDate = subDays(new Date(), retentionDays)

  // Get booking attempt counts
  const [totalBookings, approvedBookings, rejectedBookings] = await Promise.all([
    prisma.bookingAttempt.count({
      where: {
        userId: user.id,
        createdAt: { gte: cutoffDate },
      },
    }),
    prisma.bookingAttempt.count({
      where: {
        userId: user.id,
        status: 'APPROVED',
        createdAt: { gte: cutoffDate },
      },
    }),
    prisma.bookingAttempt.count({
      where: {
        userId: user.id,
        status: 'REJECTED',
        createdAt: { gte: cutoffDate },
      },
    }),
  ])

  // Get allowlist size
  const allowlistSize = await prisma.allowlistEntry.count({
    where: {
      allowlist: {
        userId: user.id,
      },
    },
  })

  // Get recent attempts
  const recentAttempts = await prisma.bookingAttempt.findMany({
    where: {
      userId: user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      eventType: {
        select: {
          name: true,
        },
      },
    },
  })

  // Get time series data for last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i)
    return {
      date: format(startOfDay(date), 'yyyy-MM-dd'),
      approved: 0,
      rejected: 0,
    }
  })

  const timeSeriesData = await prisma.bookingAttempt.groupBy({
    by: ['status', 'createdAt'],
    where: {
      userId: user.id,
      createdAt: { gte: subDays(new Date(), 30) },
    },
    _count: true,
  })

  // This is a simplified aggregation - in production you'd want to do this in SQL
  // For now, we'll just return the last30Days template
  // The actual aggregation would need a raw query for proper date grouping

  return NextResponse.json({
    totalBookings,
    approvedBookings,
    rejectedBookings,
    allowlistSize,
    allowlistLimit: tierLimits.allowlistEntries,
    recentAttempts: recentAttempts.map((attempt) => ({
      id: attempt.id,
      email: attempt.inviteeEmail,
      name: attempt.inviteeName,
      status: attempt.status,
      eventName: attempt.eventType?.name || 'Unknown Event',
      createdAt: attempt.createdAt,
    })),
    timeSeriesData: last30Days,
  })
}



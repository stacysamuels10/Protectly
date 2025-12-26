import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { TIER_LIMITS } from '@/lib/utils'
import { subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') as 'APPROVED' | 'REJECTED' | 'RATE_LIMITED' | null
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const skip = (page - 1) * limit

  const tierLimits = TIER_LIMITS[user.subscriptionTier]
  const retentionDays = tierLimits.activityLogDays === Infinity ? 365 : tierLimits.activityLogDays
  const cutoffDate = subDays(new Date(), retentionDays)

  const where = {
    userId: user.id,
    createdAt: { gte: cutoffDate },
    ...(status && { status }),
  }

  const [attempts, total] = await Promise.all([
    prisma.bookingAttempt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        eventType: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.bookingAttempt.count({ where }),
  ])

  return NextResponse.json({
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      email: attempt.inviteeEmail,
      name: attempt.inviteeName,
      status: attempt.status,
      eventName: attempt.eventType?.name || 'Unknown Event',
      rejectionReason: attempt.rejectionReason,
      createdAt: attempt.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}



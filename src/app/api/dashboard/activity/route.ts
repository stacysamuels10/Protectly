import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { TIER_LIMITS } from '@/lib/utils'
import { subDays } from 'date-fns'

/**
 * @swagger
 * /api/dashboard/activity:
 *   get:
 *     summary: Get activity log
 *     description: Returns paginated list of booking attempts with optional filtering
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [APPROVED, REJECTED, RATE_LIMITED]
 *         description: Filter by booking status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Number of entries per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by invitee email (case-insensitive contains)
 *     responses:
 *       200:
 *         description: Paginated activity log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attempts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BookingAttempt'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 statusCounts:
 *                   type: object
 *                   properties:
 *                     APPROVED:
 *                       type: integer
 *                     REJECTED:
 *                       type: integer
 *                     RATE_LIMITED:
 *                       type: integer
 *                 retentionDays:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status') as 'APPROVED' | 'REJECTED' | 'RATE_LIMITED' | null
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const search = searchParams.get('search')
  const skip = (page - 1) * limit

  const tierLimits = TIER_LIMITS[user.subscriptionTier]
  const retentionDays = tierLimits.activityLogDays === Infinity ? 365 : tierLimits.activityLogDays
  const cutoffDate = subDays(new Date(), retentionDays)

  const where = {
    userId: user.id,
    createdAt: { gte: cutoffDate },
    ...(status && { status }),
    ...(search && { inviteeEmail: { contains: search, mode: 'insensitive' as const } }),
  }

  // statusCounts query is ALWAYS unfiltered (no status/search) so tab badges show totals
  const statusCountsWhere = {
    userId: user.id,
    createdAt: { gte: cutoffDate },
  }

  const [attempts, total, countsByStatus] = await Promise.all([
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
    prisma.bookingAttempt.groupBy({
      by: ['status'],
      where: statusCountsWhere,
      _count: true,
    }),
  ])

  const statusCounts = {
    APPROVED: countsByStatus.find(c => c.status === 'APPROVED')?._count ?? 0,
    REJECTED: countsByStatus.find(c => c.status === 'REJECTED')?._count ?? 0,
    RATE_LIMITED: countsByStatus.find(c => c.status === 'RATE_LIMITED')?._count ?? 0,
  }

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
    statusCounts,
    retentionDays,
  })
}

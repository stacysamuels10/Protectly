import 'server-only'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { env } from '@/env'
import TrialExpiry3Days from '@/emails/trial-expiry-3days'
import TrialExpiry1Day from '@/emails/trial-expiry-1day'
import TrialExpired from '@/emails/trial-expired'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // 1. Bearer auth guard (D-11)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const upgradeUrl = `${appUrl}/dashboard?tab=billing`

  // 2. Expired cohort — MUST run first (D-09: write-first, email-second)
  const expiredUsers = await prisma.user.findMany({
    where: { subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now } },
    select: { id: true, email: true, name: true, emailTrialWarnings: true },
  })
  const { count: expiredCount } = await prisma.user.updateMany({
    where: { subscriptionStatus: 'TRIALING', trialEndsAt: { lt: now } },
    data: { subscriptionTier: 'FREE', subscriptionStatus: 'ACTIVE' }, // D-04
  })
  if (expiredCount > 0) {
    for (const user of expiredUsers) {
      if (!user.emailTrialWarnings) continue // D-07 guard
      try {
        await sendEmail({
          to: user.email,
          subject: 'Your PriCal trial has expired',
          react: TrialExpired({
            userName: user.name ?? user.email.split('@')[0],
            upgradeUrl,
          }),
        })
      } catch (err) {
        logger.error({ err, userId: user.id }, 'failed to send trial-expired email')
      }
    }
  }

  // 3. 1-day warning (excluded users already downgraded in step 2)
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const oneDayUsers = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'TRIALING',
      trialEndsAt: { gte: now, lte: oneDayFromNow },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
  })
  for (const user of oneDayUsers) {
    if (!user.emailTrialWarnings) continue
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your PriCal trial expires tomorrow',
        react: TrialExpiry1Day({
          userName: user.name ?? user.email.split('@')[0],
          trialEndDate: user.trialEndsAt!.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          upgradeUrl,
        }),
      })
    } catch (err) {
      logger.error({ err, userId: user.id }, 'failed to send trial-expiry-1day email')
    }
  }

  // 4. 3-day warning
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const threeDayUsers = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'TRIALING',
      trialEndsAt: { gte: twoDaysFromNow, lte: threeDaysFromNow },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true, emailTrialWarnings: true },
  })
  for (const user of threeDayUsers) {
    if (!user.emailTrialWarnings) continue
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your PriCal trial ends in 3 days',
        react: TrialExpiry3Days({
          userName: user.name ?? user.email.split('@')[0],
          trialEndDate: user.trialEndsAt!.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          upgradeUrl,
        }),
      })
    } catch (err) {
      logger.error({ err, userId: user.id }, 'failed to send trial-expiry-3day email')
    }
  }

  // 5. Summary log
  logger.info(
    { expired: expiredCount, warned1d: oneDayUsers.length, warned3d: threeDayUsers.length },
    'trial-expiry cron complete'
  )

  return Response.json({
    ok: true,
    expired: expiredCount,
    warned1d: oneDayUsers.length,
    warned3d: threeDayUsers.length,
  })
}

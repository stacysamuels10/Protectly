import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getPostHogServer } from '@/lib/posthog-server'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let action = 'completed'
  try {
    const body = await request.json()
    if (body.action === 'skipped') {
      action = 'skipped'
    }
  } catch {
    // Default to completed if no body
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { onboardingCompleted: true },
  })

  try {
    const posthog = getPostHogServer()
    posthog.capture({
      distinctId: session.userId,
      event: action === 'skipped' ? 'onboarding_skipped' : 'onboarding_completed',
    })
  } catch {
    // PostHog failure should not block onboarding completion
  }

  return NextResponse.json({ success: true })
}

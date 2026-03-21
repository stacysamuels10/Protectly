import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const patchSchema = z.object({
  emailApprovedBookings: z.boolean().optional(),
  emailRejectedBookings: z.boolean().optional(),
  emailTrialWarnings: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    emailApprovedBookings: user.emailApprovedBookings,
    emailRejectedBookings: user.emailRejectedBookings,
    emailTrialWarnings: user.emailTrialWarnings,
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  })

  return NextResponse.json({
    emailApprovedBookings: updated.emailApprovedBookings,
    emailRejectedBookings: updated.emailRejectedBookings,
    emailTrialWarnings: updated.emailTrialWarnings,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateSchema = z.object({
  guestCheckMode: z.enum(['STRICT', 'PRIMARY_ONLY', 'ANY_APPROVED']),
  guestCancelMessage: z.string().min(1).max(1000).optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    guestCheckMode: user.guestCheckMode,
    guestCancelMessage: user.guestCancelMessage,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const updateData: { guestCheckMode: 'STRICT' | 'PRIMARY_ONLY' | 'ANY_APPROVED'; guestCancelMessage?: string } = {
    guestCheckMode: parsed.data.guestCheckMode,
  }
  
  if (parsed.data.guestCancelMessage) {
    updateData.guestCancelMessage = parsed.data.guestCancelMessage
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  })

  return NextResponse.json({
    guestCheckMode: updated.guestCheckMode,
    guestCancelMessage: updated.guestCancelMessage,
  })
}


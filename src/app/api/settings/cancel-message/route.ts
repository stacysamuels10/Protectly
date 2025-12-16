import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateMessageSchema = z.object({
  cancelMessage: z.string().min(1).max(1000),
})

export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ cancelMessage: user.cancelMessage })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updateMessageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { cancelMessage } = parsed.data

  // Append branding to the message
  const messageWithBranding = `${cancelMessage} — Powered by PriCal`

  await prisma.user.update({
    where: { id: user.id },
    data: { cancelMessage: messageWithBranding },
  })

  return NextResponse.json({ cancelMessage: messageWithBranding })
}


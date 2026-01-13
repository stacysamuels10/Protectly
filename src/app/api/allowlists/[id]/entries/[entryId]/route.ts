import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateEntrySchema = z.object({
  name: z.string().optional(),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, entryId } = await params

  // Verify the allowlist belongs to the user
  const allowlist = await prisma.allowlist.findFirst({
    where: {
      id,
      userId: user.id,
    },
  })

  if (!allowlist) {
    return NextResponse.json({ error: 'Allowlist not found' }, { status: 404 })
  }

  // Verify the entry exists
  const entry = await prisma.allowlistEntry.findFirst({
    where: {
      id: entryId,
      allowlistId: id,
    },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  // Parse and validate request body
  const body = await request.json()
  const parsed = updateEntrySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { name, notes, expiresAt } = parsed.data

  const updatedEntry = await prisma.allowlistEntry.update({
    where: { id: entryId },
    data: {
      ...(name !== undefined && { name }),
      ...(notes !== undefined && { notes }),
      ...(expiresAt !== undefined && { 
        expiresAt: expiresAt ? new Date(expiresAt) : null 
      }),
    },
  })

  return NextResponse.json({ entry: updatedEntry })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, entryId } = await params

  // Verify the allowlist belongs to the user
  const allowlist = await prisma.allowlist.findFirst({
    where: {
      id,
      userId: user.id,
    },
  })

  if (!allowlist) {
    return NextResponse.json({ error: 'Allowlist not found' }, { status: 404 })
  }

  // Delete the entry
  await prisma.allowlistEntry.deleteMany({
    where: {
      id: entryId,
      allowlistId: id,
    },
  })

  return NextResponse.json({ success: true })
}




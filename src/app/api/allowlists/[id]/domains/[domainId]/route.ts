import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, domainId } = await params

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

  // Find the domain entry
  const domainEntry = await prisma.domainEntry.findFirst({
    where: {
      id: domainId,
      allowlistId: id,
    },
  })

  if (!domainEntry) {
    return NextResponse.json({ error: 'Domain entry not found' }, { status: 404 })
  }

  // Write audit record FIRST (persists even if deletion fails)
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'REMOVE_DOMAIN',
      targetEmail: domainEntry.domain,
      allowlistId: id,
    },
  })

  // Delete the domain entry
  await prisma.domainEntry.delete({
    where: { id: domainId },
  })

  return NextResponse.json({ success: true })
}

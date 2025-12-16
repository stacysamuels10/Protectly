import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getSession } from '@/lib/session'

export async function DELETE() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete all user data (cascades will handle related records)
  await prisma.user.delete({
    where: { id: user.id },
  })

  // Clear the session
  const session = await getSession()
  session.destroy()

  return NextResponse.json({ success: true })
}


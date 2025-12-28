import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getSession } from '@/lib/session'

/**
 * @swagger
 * /api/settings/account:
 *   delete:
 *     summary: Delete account
 *     description: Permanently deletes the user account and all associated data. This action cannot be undone.
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Not authenticated
 */
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



import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

/**
 * @swagger
 * /api/allowlists:
 *   get:
 *     summary: List all allowlists
 *     description: Returns all allowlists for the authenticated user, including entry counts and associated event types
 *     tags: [Allowlists]
 *     responses:
 *       200:
 *         description: List of allowlists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 allowlists:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Allowlist'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowlists = await prisma.allowlist.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: { entries: true },
      },
      eventType: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ allowlists })
}



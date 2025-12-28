import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateMessageSchema = z.object({
  cancelMessage: z.string().min(1).max(1000),
})

/**
 * @swagger
 * /api/settings/cancel-message:
 *   get:
 *     summary: Get cancellation message
 *     description: Returns the custom cancellation message shown to unauthorized invitees
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Current cancellation message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cancelMessage:
 *                   type: string
 *       401:
 *         description: Not authenticated
 */
export async function GET() {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ cancelMessage: user.cancelMessage })
}

/**
 * @swagger
 * /api/settings/cancel-message:
 *   put:
 *     summary: Update cancellation message
 *     description: Update the custom cancellation message shown to unauthorized invitees
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancelMessage
 *             properties:
 *               cancelMessage:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: The cancellation message to display
 *     responses:
 *       200:
 *         description: Message updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cancelMessage:
 *                   type: string
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Not authenticated
 */
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

  await prisma.user.update({
    where: { id: user.id },
    data: { cancelMessage },
  })

  return NextResponse.json({ cancelMessage })
}



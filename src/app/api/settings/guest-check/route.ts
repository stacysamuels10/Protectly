import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

const updateSchema = z.object({
  guestCheckMode: z.enum(['STRICT', 'PRIMARY_ONLY', 'ANY_APPROVED', 'NO_GUESTS', 'ALLOW_ALL']),
  guestCancelMessage: z.string().min(1).max(1000).optional(),
})

/**
 * @swagger
 * /api/settings/guest-check:
 *   get:
 *     summary: Get guest check settings
 *     description: Returns the current guest check mode and cancellation message
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Guest check settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guestCheckMode:
 *                   type: string
 *                   enum: [STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL]
 *                   description: |
 *                     - STRICT: All participants must be approved
 *                     - PRIMARY_ONLY: Only check the scheduling invitee
 *                     - ANY_APPROVED: Allow if any participant is approved
 *                     - NO_GUESTS: Approved invitee only, no guests
 *                     - ALLOW_ALL: Allow all meetings (protection disabled)
 *                 guestCancelMessage:
 *                   type: string
 *                   description: Message shown when guests cause cancellation
 *       401:
 *         description: Not authenticated
 */
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

/**
 * @swagger
 * /api/settings/guest-check:
 *   put:
 *     summary: Update guest check settings
 *     description: Update the guest check mode and optional cancellation message
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestCheckMode
 *             properties:
 *               guestCheckMode:
 *                 type: string
 *                 enum: [STRICT, PRIMARY_ONLY, ANY_APPROVED, NO_GUESTS, ALLOW_ALL]
 *               guestCancelMessage:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 guestCheckMode:
 *                   type: string
 *                 guestCancelMessage:
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
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const updateData: { guestCheckMode: 'STRICT' | 'PRIMARY_ONLY' | 'ANY_APPROVED' | 'NO_GUESTS' | 'ALLOW_ALL'; guestCancelMessage?: string } = {
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


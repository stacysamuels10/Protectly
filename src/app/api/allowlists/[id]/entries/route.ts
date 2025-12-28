import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isValidEmail, TIER_LIMITS } from '@/lib/utils'
import { z } from 'zod'

const addEntriesSchema = z.object({
  emails: z.array(z.string()).min(1),
  name: z.string().optional(),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

/**
 * @swagger
 * /api/allowlists/{id}/entries:
 *   get:
 *     summary: List allowlist entries
 *     description: Returns paginated list of email entries in the specified allowlist
 *     tags: [Allowlists]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Allowlist ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter by email or name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Number of entries per page
 *     responses:
 *       200:
 *         description: Paginated list of entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AllowlistEntry'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Allowlist not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '25', 10)
  const skip = (page - 1) * limit

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

  const where = {
    allowlistId: id,
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [entries, total] = await Promise.all([
    prisma.allowlistEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.allowlistEntry.count({ where }),
  ])

  return NextResponse.json({
    entries,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

/**
 * @swagger
 * /api/allowlists/{id}/entries:
 *   post:
 *     summary: Add entries to allowlist
 *     description: Add one or more email addresses to the allowlist
 *     tags: [Allowlists]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Allowlist ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emails
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of email addresses to add
 *                 example: ["user@example.com", "another@example.com"]
 *               name:
 *                 type: string
 *                 description: Optional name for the entries
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiration date
 *     responses:
 *       200:
 *         description: Entries added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 added:
 *                   type: integer
 *                   description: Number of entries added
 *                 duplicates:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Emails that already existed
 *                 invalid:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Invalid email addresses
 *                 addedEmails:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Successfully added emails
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Allowlist limit exceeded
 *       404:
 *         description: Allowlist not found
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify the allowlist belongs to the user
  const allowlist = await prisma.allowlist.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      _count: {
        select: { entries: true },
      },
    },
  })

  if (!allowlist) {
    return NextResponse.json({ error: 'Allowlist not found' }, { status: 404 })
  }

  // Parse and validate request body
  const body = await request.json()
  const parsed = addEntriesSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { emails, name, notes, expiresAt } = parsed.data

  // Check tier limits
  const tierLimits = TIER_LIMITS[user.subscriptionTier]
  const currentCount = allowlist._count.entries
  const newCount = currentCount + emails.length

  if (newCount > tierLimits.allowlistEntries) {
    return NextResponse.json(
      {
        error: 'Allowlist limit exceeded',
        message: `Your ${user.subscriptionTier} plan allows ${tierLimits.allowlistEntries} entries. You currently have ${currentCount} entries.`,
        limit: tierLimits.allowlistEntries,
        current: currentCount,
      },
      { status: 403 }
    )
  }

  // Process emails
  const added: string[] = []
  const duplicates: string[] = []
  const invalid: string[] = []

  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase()

    if (!isValidEmail(normalizedEmail)) {
      invalid.push(email)
      continue
    }

    // Check if already exists
    const existing = await prisma.allowlistEntry.findFirst({
      where: {
        allowlistId: id,
        email: normalizedEmail,
      },
    })

    if (existing) {
      duplicates.push(email)
      continue
    }

    // Create entry
    await prisma.allowlistEntry.create({
      data: {
        allowlistId: id,
        email: normalizedEmail,
        name: name || null,
        notes: notes || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        addedById: user.id,
      },
    })

    added.push(normalizedEmail)
  }

  return NextResponse.json({
    added: added.length,
    duplicates,
    invalid,
    addedEmails: added,
  })
}



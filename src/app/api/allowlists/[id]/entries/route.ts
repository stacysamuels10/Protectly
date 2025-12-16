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


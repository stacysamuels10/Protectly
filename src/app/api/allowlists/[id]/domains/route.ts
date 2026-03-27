import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { TIER_LIMITS } from '@/lib/utils'
import { z } from 'zod'
import { getPostHogServer } from '@/lib/posthog-server'

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com',
  'aol.com', 'icloud.com', 'protonmail.com', 'live.com',
  'msn.com', 'me.com', 'mac.com',
])

const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

const addDomainsSchema = z.object({
  domains: z.array(z.string()).min(1),
})

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

function validateDomain(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeDomain(raw)
  if (!normalized || normalized === '.') {
    return { valid: false, normalized, error: 'Invalid domain format' }
  }
  if (normalized.length > 253) {
    return { valid: false, normalized, error: 'Domain exceeds maximum length of 253 characters' }
  }
  if (!domainRegex.test(normalized)) {
    return { valid: false, normalized, error: `Invalid domain format: "${raw}"` }
  }
  if (FREE_EMAIL_PROVIDERS.has(normalized)) {
    return { valid: false, normalized, error: `"${normalized}" is a free email provider. Domain allowlisting is intended for corporate domains only.` }
  }
  return { valid: true, normalized }
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
        select: { domainEntries: true },
      },
    },
  })

  if (!allowlist) {
    return NextResponse.json({ error: 'Allowlist not found' }, { status: 404 })
  }

  // Parse and validate request body
  const body = await request.json()
  const parsed = addDomainsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { domains } = parsed.data

  // Check tier limits
  const tierLimits = TIER_LIMITS[user.subscriptionTier]
  const currentCount = allowlist._count.domainEntries
  const newCount = currentCount + domains.length

  if (newCount > tierLimits.domainEntries) {
    return NextResponse.json(
      {
        error: 'Domain entry limit exceeded',
        message: `Your ${user.subscriptionTier} plan allows ${tierLimits.domainEntries} domain entries. You currently have ${currentCount}.`,
        limit: tierLimits.domainEntries,
        current: currentCount,
      },
      { status: 403 }
    )
  }

  // Process domains
  const added: string[] = []
  const duplicates: string[] = []
  const invalid: string[] = []

  for (const raw of domains) {
    const validation = validateDomain(raw)

    if (!validation.valid) {
      // Free email providers are blocked entirely with 400
      if (FREE_EMAIL_PROVIDERS.has(validation.normalized)) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        )
      }
      invalid.push(raw)
      continue
    }

    const normalized = validation.normalized

    // Check if already exists
    const existing = await prisma.domainEntry.findFirst({
      where: {
        allowlistId: id,
        domain: normalized,
      },
    })

    if (existing) {
      duplicates.push(normalized)
      continue
    }

    // Write audit record FIRST (persists even if entry creation fails)
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADD_DOMAIN',
        targetEmail: normalized,
        allowlistId: id,
      },
    })

    // Create entry
    await prisma.domainEntry.create({
      data: {
        allowlistId: id,
        domain: normalized,
      },
    })

    added.push(normalized)
  }

  if (added.length > 0) {
    const ph = getPostHogServer()
    ph?.capture({ distinctId: user.id, event: 'add_domain', properties: { allowlistId: id, count: added.length } })
    if (ph) await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
  }

  return NextResponse.json({
    added: added.length,
    duplicates,
    invalid,
    addedDomains: added,
  })
}

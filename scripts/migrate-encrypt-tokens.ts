/**
 * One-time idempotent migration script: encrypts all plaintext Calendly OAuth tokens in the users table.
 *
 * This script is intentionally self-contained (no @/env import) so it can be run standalone
 * against any database with only DATABASE_URL and ENCRYPTION_KEY set.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-encrypt-tokens.ts   # preview changes
 *   npx tsx scripts/migrate-encrypt-tokens.ts                # encrypt plaintext rows
 *
 * Production (via Railway CLI):
 *   railway run npx tsx scripts/migrate-encrypt-tokens.ts
 *
 * RECOMMENDED DEPLOY ORDER:
 *   1. Run this migration against production DB first (dry-run, then real)
 *   2. Verify "Remaining plaintext token rows: 0" in output
 *   3. Deploy Phase 2 application code (Plans 01 + 02)
 *   This avoids any window where decrypt() is called on plaintext rows.
 */

import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

// Read only the keys this script needs — avoids pulling in @/env and all its validators.
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!ENCRYPTION_KEY_HEX) {
  console.error('ERROR: ENCRYPTION_KEY environment variable is required')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required')
  process.exit(1)
}

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex') // 32 bytes for AES-256

/** Encrypt a plaintext string using AES-256-GCM. Returns enc:v1: envelope. */
function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12) // 96-bit IV required for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag() // 128-bit authentication tag
  // Version-prefixed format — matches encryption.ts format exactly
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === 'true'

async function main() {
  console.log(`Starting token migration (DRY_RUN=${DRY_RUN})`)

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { calendlyAccessToken: { not: null } },
        { calendlyRefreshToken: { not: null } },
      ],
    },
    select: { id: true, calendlyAccessToken: true, calendlyRefreshToken: true },
  })

  console.log(`Found ${users.length} users with tokens`)

  let migrated = 0
  let skipped = 0

  for (const user of users) {
    const accessNeedsEncryption =
      user.calendlyAccessToken && !user.calendlyAccessToken.startsWith('enc:v1:')
    const refreshNeedsEncryption =
      user.calendlyRefreshToken && !user.calendlyRefreshToken.startsWith('enc:v1:')

    if (!accessNeedsEncryption && !refreshNeedsEncryption) {
      skipped++
      continue
    }

    if (!DRY_RUN) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(accessNeedsEncryption
            ? { calendlyAccessToken: encrypt(user.calendlyAccessToken!) }
            : {}),
          ...(refreshNeedsEncryption
            ? { calendlyRefreshToken: encrypt(user.calendlyRefreshToken!) }
            : {}),
        },
      })
    }

    migrated++
    console.log(`[${DRY_RUN ? 'DRY RUN' : 'MIGRATED'}] User ${user.id}`)
  }

  console.log(`\nSummary: ${migrated} migrated, ${skipped} already encrypted`)

  // Verification: count any remaining plaintext rows
  const plaintext = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM users
    WHERE ("calendlyAccessToken" IS NOT NULL AND "calendlyAccessToken" NOT LIKE 'enc:v1:%')
       OR ("calendlyRefreshToken" IS NOT NULL AND "calendlyRefreshToken" NOT LIKE 'enc:v1:%')
  `
  console.log(`Remaining plaintext token rows: ${plaintext[0].count}`)

  if (!DRY_RUN && plaintext[0].count > BigInt(0)) {
    console.error(
      `ERROR: ${plaintext[0].count} plaintext rows remain after migration — investigate before deploying`
    )
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

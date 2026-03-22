import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

function escapeCSVField(value: string): string {
  // Wrap all fields in double-quotes and escape inner quotes as ""
  return `"${value.replace(/"/g, '""')}"`
}

export async function GET(
  _request: NextRequest,
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
  })

  if (!allowlist) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch ALL entries — no pagination, no search filter per D-04
  const entries = await prisma.allowlistEntry.findMany({
    where: { allowlistId: id },
    orderBy: { createdAt: 'desc' },
  })

  // Build CSV string
  const header = 'email,name,notes,dateAdded'
  const rows = entries.map((e) => {
    const email = escapeCSVField(e.email)
    const name = escapeCSVField(e.name ?? '')
    const notes = escapeCSVField(e.notes ?? '')
    const dateAdded = escapeCSVField(e.createdAt.toISOString().slice(0, 10))
    return `${email},${name},${notes},${dateAdded}`
  })

  const csvString = [header, ...rows].join('\n')

  // Use server date for filename per D-05
  const today = new Date().toISOString().slice(0, 10)
  const filename = `prical-allowlist-${today}.csv`

  return new NextResponse(csvString, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

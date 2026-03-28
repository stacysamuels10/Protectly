import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ActivityLogClient } from '@/components/dashboard/activity-log-client'

export default async function ActivityPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const allowlist = await prisma.allowlist.findFirst({
    where: { userId: user.id, isGlobal: true },
    select: { id: true },
  })

  return (
    <Suspense fallback={<ActivityLogSkeleton />}>
      <ActivityLogClient allowlistId={allowlist?.id ?? null} />
    </Suspense>
  )
}

function ActivityLogSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-9 w-48 animate-pulse bg-muted rounded" />
        <div className="h-5 w-72 animate-pulse bg-muted rounded mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-96 animate-pulse bg-muted rounded-lg" />
    </div>
  )
}

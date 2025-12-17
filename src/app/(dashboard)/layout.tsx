import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/')
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}


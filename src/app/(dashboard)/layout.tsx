import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import Link from 'next/link'

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
    <div className="min-h-screen bg-muted/30">
      <Sidebar user={user} />
      <div className="lg:pl-64">
        <Header user={user} />
        <main className="p-6">
          {children}
        </main>
        <footer className="border-t mt-8 px-6 py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} PriCal</p>
            <div className="flex gap-4">
              <Link href="/help" className="hover:text-foreground transition-colors">Help</Link>
              <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}


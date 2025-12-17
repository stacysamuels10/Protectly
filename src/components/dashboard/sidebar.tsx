'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  Settings, 
  Shield,
  CreditCard,
  X
} from 'lucide-react'

interface SidebarProps {
  user: {
    name: string | null
    email: string
    subscriptionTier: string
  }
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Allowlist', href: '/dashboard/allowlist', icon: Users },
  { name: 'Activity Log', href: '/dashboard/activity', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

function SidebarContent({ user, onLinkClick }: { user: SidebarProps['user']; onLinkClick?: () => void }) {
  const pathname = usePathname()

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Shield className="h-6 w-6" />
        <span className="text-xl font-bold">PriCal</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Subscription Info */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {user.subscriptionTier} Plan
            </span>
          </div>
          {user.subscriptionTier === 'FREE' && (
            <Link
              href="/dashboard/settings"
              onClick={onLinkClick}
              className="text-xs text-primary hover:underline"
            >
              Upgrade for more features →
            </Link>
          )}
        </div>
      </div>
    </>
  )
}

export function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-card lg:flex">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50" 
            onClick={onMobileClose}
          />
          
          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex-col bg-card flex animate-in slide-in-from-left duration-200">
            {/* Close button */}
            <button
              onClick={onMobileClose}
              className="absolute right-4 top-4 p-2 rounded-md hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent user={user} onLinkClick={onMobileClose} />
          </aside>
        </div>
      )}
    </>
  )
}


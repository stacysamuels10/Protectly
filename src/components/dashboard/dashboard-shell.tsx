'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface DashboardShellProps {
  user: {
    name: string | null
    email: string
    avatarUrl: string | null
    subscriptionTier: string
  }
  children: React.ReactNode
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar 
        user={user} 
        mobileOpen={mobileMenuOpen} 
        onMobileClose={() => setMobileMenuOpen(false)} 
      />
      <div className="lg:pl-64">
        <Header 
          user={user} 
          onMenuClick={() => setMobileMenuOpen(true)} 
        />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}


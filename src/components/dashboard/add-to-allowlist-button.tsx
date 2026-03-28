'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'

interface AddToAllowlistButtonProps {
  allowlistId: string | null
  email: string
}

export function AddToAllowlistButton({ allowlistId, email }: AddToAllowlistButtonProps) {
  const [added, setAdded] = useState<'email' | 'domain' | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  if (!allowlistId) return null

  const domain = email.split('@')[1]

  async function handleAddEmail() {
    setLoading(true)
    try {
      const res = await fetch(`/api/allowlists/${allowlistId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [email] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Failed to add', description: data.error, variant: 'destructive' })
        return
      }
      setAdded('email')
      toast({ title: 'Added to allowlist', description: `${email} has been added.`, variant: 'success' })
    } catch {
      toast({ title: 'Failed to add', description: 'An unexpected error occurred.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddDomain() {
    setLoading(true)
    try {
      const res = await fetch(`/api/allowlists/${allowlistId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [`@${domain}`] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Failed to add', description: data.error, variant: 'destructive' })
        return
      }
      setAdded('domain')
      toast({ title: 'Added to allowlist', description: `@${domain} has been added.`, variant: 'success' })
    } catch {
      toast({ title: 'Failed to add', description: 'An unexpected error occurred.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (added) {
    return (
      <Button variant="outline" size="sm" disabled>
        Added
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? 'Adding...' : 'Add to allowlist'}
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleAddEmail}>
          Add email ({email})
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleAddDomain}>
          Add domain (@{domain})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

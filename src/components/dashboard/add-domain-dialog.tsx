'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Loader2, AlertTriangle } from 'lucide-react'

interface AddDomainDialogProps {
  allowlistId: string
}

export function AddDomainDialog({ allowlistId }: AddDomainDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [domain, setDomain] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/allowlists/${allowlistId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [domain.trim()] }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain')
      }

      if (data.duplicates?.length > 0) {
        toast({
          title: 'Domain already exists',
          description: `@${domain.trim().replace(/^@/, '')} is already on your allowlist.`,
          variant: 'destructive',
        })
      } else if (data.invalid?.length > 0) {
        toast({
          title: 'Invalid domain',
          description: `@${domain.trim().replace(/^@/, '')} is not a valid domain. Use format: @company.com`,
          variant: 'destructive',
        })
      } else if (data.added > 0) {
        toast({
          title: 'Domain added',
          description: `@${data.addedDomains[0]} has been added to your allowlist.`,
          variant: 'success',
        })
        setOpen(false)
        setDomain('')
        router.refresh()
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add an Approved Domain</DialogTitle>
            <DialogDescription>
              Add a corporate domain to your allowlist. All bookings from email addresses at this domain will be approved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <p>
                <span className="font-medium">Heads up</span> — All bookings from this domain will be approved. Only add corporate domains you trust.
              </p>
            </div>
            <div className="grid gap-4 py-0">
              <div className="grid gap-2">
                <Label htmlFor="domain">Domain *</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="@company.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Discard
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Adding...' : 'Add Domain'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

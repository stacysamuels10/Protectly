'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import { Globe, MoreHorizontal, Trash2 } from 'lucide-react'
import { AddDomainDialog } from '@/components/dashboard/add-domain-dialog'

interface DomainEntry {
  id: string
  domain: string
  createdAt: Date | string
}

interface DomainAllowlistSectionProps {
  domainEntries: DomainEntry[]
  allowlistId: string
}

export function DomainAllowlistSection({ domainEntries, allowlistId }: DomainAllowlistSectionProps) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleDelete = async (domainId: string, domain: string) => {
    if (!confirm(`Remove @${domain} from your allowlist?`)) return

    setDeleting(domainId)

    try {
      const response = await fetch(`/api/allowlists/${allowlistId}/domains/${domainId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove domain')
      }

      toast({
        title: 'Domain removed',
        description: `@${domain} has been removed from your allowlist.`,
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove domain. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  if (domainEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
          <Globe className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No approved domains yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Add a corporate domain to allow all bookings from that company&apos;s email addresses.
        </p>
        <AddDomainDialog allowlistId={allowlistId} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domainEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">@{entry.domain}</span>
                    <Badge variant="secondary">Domain</Badge>
                  </div>
                </TableCell>
                <TableCell>{formatDate(entry.createdAt)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleting === entry.id}
                        aria-label={`Row actions for @${entry.domain}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(entry.id, entry.domain)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {domainEntries.length} domain{domainEntries.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

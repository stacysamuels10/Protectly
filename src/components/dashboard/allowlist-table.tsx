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
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import { MoreHorizontal, Trash2, Search, Users } from 'lucide-react'

interface AllowlistEntry {
  id: string
  email: string
  name: string | null
  notes: string | null
  expiresAt: Date | null
  createdAt: Date
}

interface AllowlistTableProps {
  entries: AllowlistEntry[]
  allowlistId: string
}

export function AllowlistTable({ entries, allowlistId }: AllowlistTableProps) {
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const filteredEntries = entries.filter(
    (entry) =>
      entry.email.toLowerCase().includes(search.toLowerCase()) ||
      entry.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (entryId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from your allowlist?`)) {
      return
    }

    setDeleting(entryId)

    try {
      const response = await fetch(
        `/api/allowlists/${allowlistId}/entries/${entryId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete entry')
      }

      toast({
        title: 'Email removed',
        description: `${email} has been removed from your allowlist.`,
      })
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove email. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No approved emails yet</h3>
        <p className="text-muted-foreground">
          Add your first email to start protecting your calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search emails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No emails match your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.email}</TableCell>
                  <TableCell>{entry.name || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {entry.notes || '—'}
                  </TableCell>
                  <TableCell>{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deleting === entry.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(entry.id, entry.email)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredEntries.length} of {entries.length} emails
      </p>
    </div>
  )
}



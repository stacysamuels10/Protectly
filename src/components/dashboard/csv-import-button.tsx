'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Upload } from 'lucide-react'
import { TIER_LIMITS } from '@/lib/utils'

interface CsvImportButtonProps {
  allowlistId: string
  subscriptionTier: string
}

const BATCH_SIZE = 50

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function CsvImportButton({ allowlistId, subscriptionTier }: CsvImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])

  function handleImportClick() {
    const tierKey = subscriptionTier as keyof typeof TIER_LIMITS
    const canImport = TIER_LIMITS[tierKey]?.csvImport ?? false

    if (!canImport) {
      setShowUpgradeDialog(true)
      return
    }

    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportErrors([])

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: handleParseComplete,
      error: handleParseError,
    })
  }

  function handleParseError(error: Error) {
    toast({
      title: 'CSV parse error',
      description: error.message || 'Failed to parse CSV file.',
      variant: 'destructive',
    })
    setImporting(false)
  }

  async function handleParseComplete(results: Papa.ParseResult<Record<string, string>>) {
    if (!results.data || results.data.length === 0) {
      toast({
        title: 'No valid rows found',
        description: 'The CSV file has no data rows.',
        variant: 'destructive',
      })
      setImporting(false)
      return
    }

    // Find email column (case-insensitive)
    const firstRow = results.data[0]
    const emailColumn = Object.keys(firstRow).find(
      (key) => key.toLowerCase() === 'email' || key.toLowerCase() === 'email_address'
    )

    if (!emailColumn) {
      toast({
        title: 'Missing email column',
        description: "CSV must have an 'email' column.",
        variant: 'destructive',
      })
      setImporting(false)
      return
    }

    const emails = results.data
      .map((row) => row[emailColumn]?.trim())
      .filter(Boolean) as string[]

    if (emails.length === 0) {
      toast({
        title: 'No valid rows found',
        description: 'No email addresses were found in the CSV file.',
        variant: 'destructive',
      })
      setImporting(false)
      return
    }

    await processBatches(emails)
  }

  async function processBatches(emails: string[]) {
    const batches = chunk(emails, BATCH_SIZE)
    let totalAdded = 0
    let totalDuplicates = 0
    const allInvalid: string[] = []

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      setProgress({ current: i * BATCH_SIZE, total: emails.length })

      const response = await fetch(`/api/allowlists/${allowlistId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: batch }),
      })

      if (response.status === 403) {
        toast({
          title: 'Allowlist limit reached',
          description: 'You have reached the maximum number of allowlist entries for your plan.',
          variant: 'destructive',
        })
        break
      }

      if (response.ok) {
        const data = await response.json()
        totalAdded += data.added ?? 0
        totalDuplicates += data.duplicates?.length ?? 0
        if (data.invalid?.length > 0) {
          allInvalid.push(...data.invalid)
        }
      }
    }

    setProgress({ current: emails.length, total: emails.length })

    const parts: string[] = []
    if (totalAdded > 0) parts.push(`Added ${totalAdded}`)
    if (totalDuplicates > 0) parts.push(`skipped ${totalDuplicates} duplicates`)
    if (allInvalid.length > 0) parts.push(`${allInvalid.length} invalid`)

    toast({
      title: 'Import complete',
      description: parts.length > 0 ? parts.join(', ') : 'No changes made.',
      variant: totalAdded > 0 ? 'success' : 'default',
    })

    if (allInvalid.length > 0) {
      setImportErrors(allInvalid)
    }

    setImporting(false)
    setProgress(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    router.refresh()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="outline" disabled={importing} onClick={handleImportClick}>
        <Upload className="mr-2 h-4 w-4" />
        {importing
          ? `Importing... ${progress ? `${progress.current}/${progress.total}` : ''}`
          : 'Import CSV'}
      </Button>

      {/* Inline error list for invalid emails per D-02 */}
      {importErrors.length > 0 && (
        <div className="text-sm text-destructive mt-2">
          <p className="font-medium">Invalid emails:</p>
          <ul className="list-disc list-inside">
            {importErrors.slice(0, 10).map((email, i) => (
              <li key={i}>{email}</li>
            ))}
            {importErrors.length > 10 && (
              <li>...and {importErrors.length - 10} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Upgrade dialog for Free users per D-06 */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CSV Import is a Pro Feature</DialogTitle>
            <DialogDescription>
              Upgrade to Pro to import emails in bulk from a CSV file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button asChild>
              <a href="/dashboard/settings">Upgrade to Pro</a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface CsvExportButtonProps {
  allowlistId: string
}

export function CsvExportButton({ allowlistId }: CsvExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  async function handleExport() {
    setExporting(true)
    try {
      const response = await fetch(`/api/allowlists/${allowlistId}/export`)

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Export failed',
          description: 'Could not export allowlist. Please try again.',
        })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const filename = `prical-allowlist-${new Date().toISOString().slice(0, 10)}.csv`
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="outline" disabled={exporting} onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      {exporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  )
}

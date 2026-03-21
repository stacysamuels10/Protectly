'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface EmailPreferencesFormProps {
  initialApproved: boolean
  initialRejected: boolean
  initialTrialWarnings: boolean
}

export function EmailPreferencesForm({
  initialApproved,
  initialRejected,
  initialTrialWarnings,
}: EmailPreferencesFormProps) {
  const [emailApprovedBookings, setEmailApprovedBookings] = useState(initialApproved)
  const [emailRejectedBookings, setEmailRejectedBookings] = useState(initialRejected)
  const [emailTrialWarnings, setEmailTrialWarnings] = useState(initialTrialWarnings)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailApprovedBookings, emailRejectedBookings, emailTrialWarnings }),
      })

      if (!response.ok) throw new Error('Failed to save')

      toast({
        title: 'Preferences saved',
        description: 'Your email notification preferences have been updated.',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Approved bookings */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailApprovedBookings" className="text-sm font-medium">
              Approved bookings
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when a booking is confirmed
            </p>
          </div>
          <Switch
            id="emailApprovedBookings"
            checked={emailApprovedBookings}
            onCheckedChange={setEmailApprovedBookings}
          />
        </div>

        {/* Rejected bookings */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailRejectedBookings" className="text-sm font-medium">
              Rejected bookings
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when a booking is cancelled
            </p>
          </div>
          <Switch
            id="emailRejectedBookings"
            checked={emailRejectedBookings}
            onCheckedChange={setEmailRejectedBookings}
          />
        </div>

        {/* Trial warnings */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailTrialWarnings" className="text-sm font-medium">
              Trial warnings
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified before your trial expires
            </p>
          </div>
          <Switch
            id="emailTrialWarnings"
            checked={emailTrialWarnings}
            onCheckedChange={setEmailTrialWarnings}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Preferences
      </Button>
    </div>
  )
}

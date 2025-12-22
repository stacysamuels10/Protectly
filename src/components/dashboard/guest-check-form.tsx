'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Shield, User, Users } from 'lucide-react'

type GuestCheckMode = 'STRICT' | 'PRIMARY_ONLY' | 'ANY_APPROVED'

interface GuestCheckFormProps {
  initialMode: GuestCheckMode
  initialMessage: string
}

const MODE_OPTIONS = [
  {
    value: 'STRICT' as const,
    label: 'Strict',
    badge: 'Recommended',
    description: 'All participants must be on the allowlist — the person booking AND all guests.',
    icon: Shield,
  },
  {
    value: 'PRIMARY_ONLY' as const,
    label: 'Primary Only',
    badge: null,
    description: 'Only check the person scheduling. Guests are ignored.',
    icon: User,
  },
  {
    value: 'ANY_APPROVED' as const,
    label: 'Any Approved',
    badge: null,
    description: 'Allow if the booker OR any guest is on the allowlist.',
    icon: Users,
  },
]

export function GuestCheckForm({ initialMode, initialMessage }: GuestCheckFormProps) {
  const [mode, setMode] = useState<GuestCheckMode>(initialMode)
  const [message, setMessage] = useState(initialMessage)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/settings/guest-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guestCheckMode: mode,
          guestCancelMessage: message.trim(),
        }),
      })

      if (!response.ok) throw new Error('Failed to update')

      toast({
        title: 'Settings updated',
        description: 'Your guest checking preferences have been saved.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <label
              key={option.value}
              className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                mode === option.value 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <input
                type="radio"
                name="guestCheckMode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="sr-only"
              />
              <div className={`mt-0.5 p-2 rounded-md ${
                mode === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{option.label}</span>
                  {option.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {option.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
              </div>
              <div className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                mode === option.value 
                  ? 'border-primary bg-primary' 
                  : 'border-muted-foreground/30'
              }`}>
                {mode === option.value && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                )}
              </div>
            </label>
          )
        })}
      </div>

      {mode === 'STRICT' && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="guestMessage">
            Cancellation message for unapproved guests
          </Label>
          <Textarea
            id="guestMessage"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message shown when booking is cancelled due to unapproved guests..."
            rows={4}
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Used when the booker is approved but one or more guests aren&apos;t.
            </p>
            <p className="text-xs text-muted-foreground">
              {message.length}/1000
            </p>
          </div>
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Settings
      </Button>
    </form>
  )
}


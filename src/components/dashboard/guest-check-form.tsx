'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Shield, User, Users, UserX, ShieldOff } from 'lucide-react'

type GuestCheckMode = 'STRICT' | 'PRIMARY_ONLY' | 'ANY_APPROVED' | 'NO_GUESTS' | 'ALLOW_ALL'

interface GuestCheckFormProps {
  initialMode: GuestCheckMode
  initialMessage: string
}

const MODE_OPTIONS = [
  {
    value: 'STRICT' as const,
    label: 'Strict',
    badge: 'Recommended',
    badgeVariant: 'default' as const,
    description: 'All participants must be on the allowlist — the person booking AND all guests.',
    icon: Shield,
  },
  {
    value: 'PRIMARY_ONLY' as const,
    label: 'Primary Only',
    badge: null,
    badgeVariant: 'default' as const,
    description: 'Only check the person scheduling. Any additional guests are allowed.',
    icon: User,
  },
  {
    value: 'ANY_APPROVED' as const,
    label: 'Any Approved',
    badge: null,
    badgeVariant: 'default' as const,
    description: 'Allow if the booker OR any guest is on the allowlist.',
    icon: Users,
  },
  {
    value: 'NO_GUESTS' as const,
    label: 'No Guests',
    badge: null,
    badgeVariant: 'default' as const,
    description: 'Approved invitee only — no additional guests allowed at all.',
    icon: UserX,
  },
  {
    value: 'ALLOW_ALL' as const,
    label: 'Allow All',
    badge: 'Protection Off',
    badgeVariant: 'warning' as const,
    description: 'Allow all meetings without checking the allowlist. Use this to temporarily disable protection.',
    icon: ShieldOff,
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      option.badgeVariant === 'warning'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                        : 'bg-primary/10 text-primary'
                    }`}>
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

      {(mode === 'STRICT' || mode === 'NO_GUESTS') && (
        <div className="space-y-2 pt-2">
          <Label htmlFor="guestMessage">
            {mode === 'NO_GUESTS' 
              ? 'Cancellation message when guests are added' 
              : 'Cancellation message for unapproved guests'}
          </Label>
          <Textarea
            id="guestMessage"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={mode === 'NO_GUESTS' 
              ? "Message shown when booking is cancelled due to additional guests..."
              : "Message shown when booking is cancelled due to unapproved guests..."}
            rows={4}
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {mode === 'NO_GUESTS'
                ? 'Used when an approved invitee adds any guests to the booking.'
                : 'Used when the booker is approved but one or more guests aren\'t.'}
            </p>
            <p className="text-xs text-muted-foreground">
              {message.length}/1000
            </p>
          </div>
        </div>
      )}

      {mode === 'ALLOW_ALL' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Warning:</strong> All meetings will be allowed without checking your allowlist. 
            Your calendar is not protected while this mode is active.
          </p>
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Settings
      </Button>
    </form>
  )
}


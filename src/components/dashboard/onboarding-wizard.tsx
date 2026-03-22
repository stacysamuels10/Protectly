'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Shield, Mail, CheckCircle2, Loader2 } from 'lucide-react'

interface OnboardingWizardProps {
  allowlistId: string | null
}

export function OnboardingWizard({ allowlistId }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(true)
  const [email, setEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const completeOnboarding = async (action: 'completed' | 'skipped') => {
    await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setOpen(false)
    router.refresh()
  }

  const handleAddEmail = async () => {
    if (!email.trim() || !allowlistId) {
      setStep(2)
      return
    }

    setAddingEmail(true)
    try {
      const response = await fetch(`/api/allowlists/${allowlistId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [email.trim()] }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to add email')
      }

      if (data.duplicates?.length > 0) {
        toast({
          title: 'Email already exists',
          description: `${email} is already on your allowlist.`,
          variant: 'destructive',
        })
      } else if (data.invalid?.length > 0) {
        toast({
          title: 'Invalid email',
          description: `${email} is not a valid email address.`,
          variant: 'destructive',
        })
        setAddingEmail(false)
        return
      } else {
        toast({
          title: 'Email added!',
          description: `${email} has been added to your allowlist.`,
          variant: 'success',
        })
      }

      setStep(2)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add email. Please try again.'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setAddingEmail(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      completeOnboarding('skipped')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle>Welcome to Protectly!</DialogTitle>
              <DialogDescription>
                Protectly automatically screens your Calendly bookings. Only people on your approved list can book meetings with you -- everyone else gets cancelled automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => setStep(1)} className="w-full">
                Get Started
              </Button>
              <button
                type="button"
                onClick={() => completeOnboarding('skipped')}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
              >
                Skip for now
              </button>
            </DialogFooter>
          </>
        )}

        {/* Step 1: Add first email */}
        {step === 1 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle>Add your first approved contact</DialogTitle>
              <DialogDescription>
                Add the email address of someone you trust to book meetings with you. You can always add more later from your allowlist.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="onboarding-email">Email address</Label>
              <Input
                id="onboarding-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddEmail()
                  }
                }}
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleAddEmail}
                disabled={addingEmail || !email.trim()}
                className="w-full"
              >
                {addingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Email
              </Button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
              >
                Skip this step
              </button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Protection active */}
        {step === 2 && (
          <>
            <DialogHeader className="text-center items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle>You&apos;re all set!</DialogTitle>
              <DialogDescription>
                Your calendar protection is active. Any new Calendly bookings will be checked against your allowlist automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={() => completeOnboarding('completed')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface CancelMessageFormProps {
  initialMessage: string
}

export function CancelMessageForm({ initialMessage }: CancelMessageFormProps) {
  // Remove the branding suffix for editing
  const cleanMessage = initialMessage.replace(/ — Powered by PriCal$/, '')
  
  const [message, setMessage] = useState(cleanMessage)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a cancellation message.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/settings/cancel-message', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelMessage: message.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to update message')
      }

      toast({
        title: 'Message updated',
        description: 'Your cancellation message has been saved.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update message. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter your custom cancellation message..."
        rows={5}
        maxLength={1000}
      />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {message.length}/1000 characters
        </p>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Message
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Note: &ldquo;Powered by PriCal&rdquo; will be appended to your message.
      </p>
    </form>
  )
}



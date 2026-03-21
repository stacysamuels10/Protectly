import { Text, Button, Hr } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface BookingRejectedProps {
  inviteeName: string
  inviteeEmail: string
  eventTypeName: string
  eventTime: string
  rejectionReason: string
  addToAllowlistUrl: string
}

export default function BookingRejected({
  inviteeName,
  inviteeEmail,
  eventTypeName,
  eventTime,
  rejectionReason,
  addToAllowlistUrl,
}: BookingRejectedProps) {
  return (
    <BaseLayout preview={`A booking from ${inviteeName} was cancelled`}>
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Booking cancelled
      </Text>
      <Text
        style={{
          fontSize: '16px',
          color: '#374151',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}
      >
        A booking from{' '}
        <strong>{inviteeName}</strong> ({inviteeEmail}) for{' '}
        <strong>{eventTypeName}</strong> on {eventTime} was cancelled
        &mdash; {rejectionReason}.
      </Text>
      <Text
        style={{
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '24px',
        }}
      >
        You can add them with one click if this was someone you expected.
      </Text>
      <Button
        href={addToAllowlistUrl}
        style={{
          backgroundColor: '#6366f1',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '600',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Add to allowlist
      </Button>
      <Hr style={{ borderColor: '#e5e7eb', marginTop: '32px' }} />
    </BaseLayout>
  )
}

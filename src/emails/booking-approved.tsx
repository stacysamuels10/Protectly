import { Text, Hr } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface BookingApprovedProps {
  inviteeName: string
  inviteeEmail: string
  eventTypeName: string
  eventTime: string
}

export default function BookingApproved({
  inviteeName,
  inviteeEmail,
  eventTypeName,
  eventTime,
}: BookingApprovedProps) {
  return (
    <BaseLayout preview={`A booking from ${inviteeName} was approved`}>
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Booking confirmed
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
        <strong>{eventTypeName}</strong> on {eventTime} has been confirmed.
        They are on your allowlist.
      </Text>
      <Hr style={{ borderColor: '#e5e7eb' }} />
      <Text
        style={{
          fontSize: '14px',
          color: '#6b7280',
          marginTop: '16px',
        }}
      >
        No action required — the meeting is on your calendar.
      </Text>
    </BaseLayout>
  )
}

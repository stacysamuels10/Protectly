import { Text, Button, Hr } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface TrialExpiry3DaysProps {
  userName: string
  trialEndDate: string
  upgradeUrl: string
}

export default function TrialExpiry3Days({
  userName,
  trialEndDate,
  upgradeUrl,
}: TrialExpiry3DaysProps) {
  return (
    <BaseLayout preview="Your PriCal trial ends in 3 days">
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Your trial ends in 3 days
      </Text>
      <Text
        style={{
          fontSize: '16px',
          color: '#374151',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}
      >
        Hi {userName}, your free trial ends on <strong>{trialEndDate}</strong>.
        Upgrade to keep protecting your calendar from unauthorized bookings.
      </Text>
      <Button
        href={upgradeUrl}
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
        Upgrade now
      </Button>
      <Hr style={{ borderColor: '#e5e7eb', marginTop: '32px' }} />
    </BaseLayout>
  )
}

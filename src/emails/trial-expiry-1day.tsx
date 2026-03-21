import { Text, Button, Hr } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface TrialExpiry1DayProps {
  userName: string
  trialEndDate: string
  upgradeUrl: string
}

export default function TrialExpiry1Day({
  userName,
  trialEndDate,
  upgradeUrl,
}: TrialExpiry1DayProps) {
  return (
    <BaseLayout preview="Your PriCal trial expires tomorrow">
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Your trial expires tomorrow
      </Text>
      <Text
        style={{
          fontSize: '16px',
          color: '#374151',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}
      >
        Hi {userName}, your trial expires tomorrow ({trialEndDate}). After
        that, booking protection will be paused until you upgrade.
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

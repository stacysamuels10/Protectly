import { Text, Button, Hr } from '@react-email/components'
import { BaseLayout } from './layout/base-layout'

interface TrialExpiredProps {
  userName: string
  upgradeUrl: string
}

export default function TrialExpired({ userName, upgradeUrl }: TrialExpiredProps) {
  return (
    <BaseLayout preview="Your PriCal trial has expired">
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Your trial has expired
      </Text>
      <Text
        style={{
          fontSize: '16px',
          color: '#374151',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}
      >
        Hi {userName}, your free trial has expired and your account has been
        moved to the free plan. Upgrade anytime to resume full protection.
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

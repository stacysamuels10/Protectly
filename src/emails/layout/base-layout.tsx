import {
  Html,
  Head,
  Body,
  Container,
  Preview,
  Text,
  Hr,
} from '@react-email/components'

interface BaseLayoutProps {
  preview?: string
  children: React.ReactNode
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          margin: '0',
          padding: '0',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '40px 20px',
          }}
        >
          <Text
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#6366f1',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '32px',
            }}
          >
            PriCal
          </Text>
          {children}
          <Hr style={{ borderColor: '#e5e7eb', marginTop: '32px' }} />
          <Text
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginTop: '16px',
            }}
          >
            You received this because you have a PriCal account. PriCal helps
            you protect your Calendly bookings from unauthorized meetings.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

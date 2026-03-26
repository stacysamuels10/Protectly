import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | PriCal',
  description: 'PriCal Privacy Policy - how we handle your data',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-6 w-6" />
            <span className="text-xl font-bold">PriCal</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/api/auth/calendly">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/api/auth/calendly">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container py-16">
        <div className="max-w-3xl mx-auto prose prose-slate">
          <h1>Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>

          <p>
            PriCal (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, and safeguard your information when you use our
            Calendly booking protection service.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Account Data</h3>
          <p>
            When you sign up with Calendly OAuth, we collect your name and email address. This information
            is used to identify your account and communicate with you about the service.
          </p>

          <h3>Calendly Integration Data</h3>
          <p>
            To provide the booking protection service, we store:
          </p>
          <ul>
            <li>
              <strong>OAuth tokens:</strong> Your Calendly access and refresh tokens are stored encrypted
              at rest using AES-256-GCM encryption. These tokens allow PriCal to receive and act on
              booking webhooks on your behalf.
            </li>
            <li>
              <strong>Booking event data:</strong> When a booking occurs, we receive and process the
              invitee&apos;s name, email address, and event type to determine whether to allow or cancel
              the meeting.
            </li>
          </ul>

          <h3>Payment Data</h3>
          <p>
            Payments are processed securely by <strong>Stripe</strong>. PriCal does not store credit
            card numbers or sensitive payment information. We retain subscription status, plan tier,
            and billing history references for account management.
          </p>

          <h3>Usage Data</h3>
          <ul>
            <li>
              <strong>Analytics:</strong> We use <strong>PostHog</strong> to collect anonymized product
              analytics including page views and feature usage. This data helps us improve the service.
              No personally identifiable information is sent to PostHog.
            </li>
            <li>
              <strong>Error monitoring:</strong> We use <strong>Sentry</strong> to capture application
              errors. Stack traces and request paths are collected, but all PII is scrubbed before
              transmission. We do not send names, emails, or other personal data to Sentry.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide the allowlist-based booking protection service — monitoring incoming booking
              events and cancelling meetings from non-allowlisted invitees</li>
            <li>To process payments and manage your subscription via Stripe</li>
            <li>To send transactional emails (booking notifications, trial warnings, account alerts)
              via Resend</li>
            <li>To improve the service through anonymized analytics collected via PostHog</li>
            <li>To diagnose and fix technical issues using error monitoring via Sentry</li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <p>PriCal integrates with the following third-party services:</p>
          <ul>
            <li><strong>Calendly</strong> — Calendar integration and OAuth authentication provider</li>
            <li><strong>Stripe</strong> — Secure payment processing and subscription management</li>
            <li><strong>PostHog</strong> — Product analytics (anonymized, no PII)</li>
            <li><strong>Sentry</strong> — Error monitoring and application diagnostics (PII scrubbed)</li>
            <li><strong>Resend</strong> — Transactional email delivery</li>
            <li><strong>Vercel</strong> — Application hosting and serverless functions</li>
            <li><strong>Upstash Redis</strong> — Rate limiting to protect the service from abuse</li>
          </ul>
          <p>
            Each third-party service has its own privacy policy. We encourage you to review their policies
            if you have concerns about how they handle data.
          </p>

          <h2>4. Data Retention</h2>
          <ul>
            <li>Account data is retained while your account is active</li>
            <li>Audit logs are retained based on your subscription tier:
              <ul>
                <li>Free tier: 30 days</li>
                <li>Pro tier: 90 days</li>
                <li>Business tier: 365 days</li>
              </ul>
            </li>
            <li>Calendly OAuth tokens are encrypted at rest and permanently deleted when you delete
              your account</li>
            <li>Upon account deletion, all associated data including allowlist entries, booking history,
              and audit logs is permanently removed</li>
          </ul>

          <h2>5. Your Rights (GDPR / CCPA)</h2>
          <p>
            Depending on your location, you may have the following rights regarding your personal data:
          </p>
          <ul>
            <li><strong>Right to access:</strong> Request a copy of the data we hold about you</li>
            <li><strong>Right to deletion:</strong> Request deletion of your account and all associated
              data. You can initiate this from your account settings.</li>
            <li><strong>Right to export:</strong> Request an export of your data in a portable format</li>
            <li><strong>Right to opt out of analytics:</strong> You can disable PostHog analytics
              tracking at any time from your account settings</li>
            <li><strong>Right to correction:</strong> Request correction of inaccurate personal data</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@prical.com">privacy@prical.com</a>.
          </p>

          <h2>6. Cookies</h2>
          <ul>
            <li>
              <strong>Session cookie:</strong> An httpOnly session cookie is required for authentication.
              This cookie cannot be accessed by JavaScript and is essential for the service to function.
            </li>
            <li>
              <strong>Analytics cookies:</strong> PostHog may set cookies to track anonymous usage
              patterns. These can be disabled in your account settings or via your browser&apos;s
              cookie controls.
            </li>
          </ul>

          <h2>7. Data Security</h2>
          <p>
            We take the security of your data seriously:
          </p>
          <ul>
            <li>Calendly OAuth tokens are encrypted at rest using AES-256-GCM</li>
            <li>All data is transmitted over HTTPS/TLS</li>
            <li>API endpoints are rate-limited to prevent abuse</li>
            <li>Session cookies are httpOnly and secure</li>
            <li>Webhook signatures are verified using HMAC-SHA256</li>
          </ul>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of material
            changes via email to the address associated with your account. Continued use of PriCal
            after changes become effective constitutes your acceptance of the updated policy.
          </p>

          <h2>9. Contact</h2>
          <p>
            For privacy-related inquiries, data requests, or concerns, please contact us at:{' '}
            <a href="mailto:privacy@prical.com">privacy@prical.com</a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">PriCal</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} PriCal. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/help" className="hover:text-foreground transition-colors">Help</Link>
              <Link href="/compare" className="hover:text-foreground transition-colors">Compare</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="mailto:privacy@prical.com" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

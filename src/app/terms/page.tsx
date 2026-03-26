import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service | PriCal',
  description: 'PriCal Terms of Service',
}

export default function TermsPage() {
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
          <h1>Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>

          <p>
            Please read these Terms of Service (&quot;Terms&quot;) carefully before using PriCal. By
            accessing or using the service, you agree to be bound by these Terms. If you do not agree,
            do not use PriCal.
          </p>

          <h2>1. Service Description</h2>
          <p>
            PriCal provides automated Calendly booking protection via email-based allowlists. The service works as follows:
          </p>
          <ul>
            <li>You connect your Calendly account to PriCal via OAuth</li>
            <li>You create and manage an allowlist of approved email addresses</li>
            <li>PriCal monitors your Calendly booking events via webhooks</li>
            <li>When a booking is received, PriCal checks whether the invitee&apos;s email is on your
              allowlist</li>
            <li>Meetings from non-allowlisted invitees are automatically cancelled via the Calendly API</li>
          </ul>
          <p>
            The service requires an active Calendly account. PriCal is an independent service and is
            not affiliated with or endorsed by Calendly.
          </p>

          <h2>2. Account Terms</h2>
          <ul>
            <li>You must be at least 18 years old to use PriCal</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>Each PriCal account may be connected to one Calendly account</li>
            <li>You must provide accurate and current information when creating your account</li>
            <li>You are responsible for all activity that occurs under your account</li>
          </ul>

          <h2>3. Subscription Tiers and Payment</h2>

          <h3>Plans</h3>
          <ul>
            <li>
              <strong>Free:</strong> 25 allowlist entries, 1 event type, 30-day activity log. No credit
              card required.
            </li>
            <li>
              <strong>Pro:</strong> $9/month or $90/year. 500 allowlist entries, unlimited event types,
              90-day activity log, CSV import, priority support.
            </li>
            <li>
              <strong>Business:</strong> $29/month or $290/year. 2,000 allowlist entries, unlimited
              event types, 365-day activity log, team members, advanced analytics.
            </li>
          </ul>

          <h3>Trial</h3>
          <p>
            New accounts receive a 14-day free trial with access to Pro-tier features. No credit card
            is required to start your trial. At the end of the trial period, your account will
            automatically downgrade to the Free tier unless you subscribe.
          </p>

          <h3>Billing</h3>
          <ul>
            <li>Payments are processed securely by <strong>Stripe</strong></li>
            <li>Subscriptions renew automatically at the end of each billing period</li>
            <li>Prices may change with 30 days advance notice sent to your account email</li>
            <li>All prices are in USD and exclude applicable taxes</li>
          </ul>

          <h2>4. Cancellation and Refunds</h2>
          <ul>
            <li>You may cancel your subscription at any time from your billing settings</li>
            <li>Access to paid features continues until the end of your current billing period</li>
            <li>No partial refunds are provided for unused time in the current billing period</li>
            <li>Upon cancellation, your account reverts to the Free tier; your data is not deleted</li>
            <li>Free tier access remains available indefinitely after cancellation</li>
          </ul>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to use PriCal to:</p>
          <ul>
            <li>Harass, discriminate against, or harm any individual based on protected characteristics</li>
            <li>Circumvent rate limits, security measures, or technical restrictions of the service</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of the service</li>
            <li>Use the service for any illegal purpose or in violation of applicable laws</li>
            <li>Resell or sublicense the service without written permission</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms, without
            prior notice in cases of severe violations.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p>PriCal is not liable for:</p>
          <ul>
            <li>Missed cancellations due to Calendly API outages or delays</li>
            <li>Lost bookings or business opportunities resulting from automated cancellations</li>
            <li>Actions taken by Calendly based on our cancellation requests</li>
            <li>Any indirect, incidental, special, or consequential damages</li>
            <li>Data loss due to circumstances beyond our reasonable control</li>
          </ul>
          <p>
            Our maximum liability to you for any claims arising under these Terms is limited to the
            total fees you paid to PriCal in the 12 months preceding the claim.
          </p>

          <h2>7. Intellectual Property</h2>
          <ul>
            <li>PriCal owns all rights to the service, including its code, design, and branding</li>
            <li>You retain full ownership of your data, including your allowlist entries and booking
              history</li>
            <li>By using the service, you grant PriCal a limited license to process your data solely
              for the purpose of providing the service</li>
          </ul>

          <h2>8. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated via
            email to your account address at least 30 days before they take effect. The changes will
            be highlighted in the updated document. Continued use of PriCal after the effective date
            constitutes your acceptance of the revised Terms.
          </p>

          <h2>9. Dispute Resolution</h2>
          <p>
            These Terms are governed by the laws of the United States, without regard to conflict of
            law provisions.
          </p>
          <ul>
            <li>
              <strong>Arbitration:</strong> Any disputes arising from or relating to these Terms or
              your use of PriCal will be resolved through binding arbitration rather than in court,
              except as provided below.
            </li>
            <li>
              <strong>Small claims:</strong> Either party may bring claims in small claims court if
              they qualify under applicable rules.
            </li>
            <li>
              <strong>Class action waiver:</strong> You waive any right to bring claims as a class
              action or representative proceeding.
            </li>
            <li>
              <strong>Opt-out:</strong> You may opt out of binding arbitration within 30 days of
              first accepting these Terms by emailing <a href="mailto:legal@prical.com">legal@prical.com</a>.
            </li>
          </ul>

          <h2>10. Contact</h2>
          <p>
            For legal inquiries or questions about these Terms, please contact us at:{' '}
            <a href="mailto:legal@prical.com">legal@prical.com</a>
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
              <Link href="mailto:legal@prical.com" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

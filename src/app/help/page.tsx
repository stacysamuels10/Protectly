import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export const metadata: Metadata = {
  title: 'Help Center | PriCal',
  description: 'Get help with PriCal - getting started, how-to guides, pricing FAQ, and troubleshooting',
}

export default function HelpPage() {
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

      {/* Page Header */}
      <main className="container py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Help Center</h1>
          <p className="text-xl text-muted-foreground mb-12">
            Find answers to common questions about PriCal
          </p>

          {/* Section 1: Getting Started */}
          <h2 className="text-2xl font-semibold mt-8 mb-4">Getting Started</h2>
          <Accordion type="multiple">
            <AccordionItem value="what-is-prical">
              <AccordionTrigger>What is PriCal?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  PriCal automatically protects your Calendly links by cancelling bookings from people
                  not on your approved allowlist. Set it up once, and it works 24/7.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-to-setup">
              <AccordionTrigger>How do I set up PriCal?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  <ol>
                    <li>Sign in with your Calendly account.</li>
                    <li>
                      Add emails to your allowlist — these are the people allowed to book with you.
                    </li>
                    <li>
                      Set up the Calendly webhook — go to your Calendly account &gt; Integrations &gt; Webhooks,
                      create a webhook pointing to{' '}
                      <code className="text-sm bg-muted px-1 py-0.5 rounded">
                        https://prical.com/api/webhooks/calendly
                      </code>{' '}
                      for the &quot;invitee.created&quot; event.
                    </li>
                    <li>
                      You&apos;re protected — PriCal will now automatically screen new bookings.
                    </li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="known-limitations">
              <AccordionTrigger>What are the known limitations?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  <ul>
                    <li>
                      PriCal only works with Calendly (no Google Calendar or Outlook direct integration).
                    </li>
                    <li>
                      Webhook delivery depends on Calendly&apos;s infrastructure — occasional delays of a
                      few seconds are normal.
                    </li>
                    <li>
                      Cancelled bookings cannot be automatically re-created if someone is later added to
                      the allowlist.
                    </li>
                    <li>CSV import is limited to Pro+ plans.</li>
                    <li>
                      Beta: some features are still being refined — please report issues.
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="feedback">
              <AccordionTrigger>How do I report bugs or give feedback?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Visit our{' '}
                  <a
                    href="https://github.com/prical/prical/issues"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub Issues page
                  </a>{' '}
                  to report bugs or suggest features. You can also email us at{' '}
                  <a href="mailto:support@prical.com" className="text-primary hover:underline">
                    support@prical.com
                  </a>
                  .
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Section 2: How-To Guides */}
          <h2 className="text-2xl font-semibold mt-12 mb-4">How-To Guides</h2>
          <Accordion type="multiple">
            <AccordionItem value="add-to-allowlist">
              <AccordionTrigger>How do I add someone to my allowlist?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Go to the Allowlist page from the dashboard sidebar. Click &quot;Add Email&quot; and
                  enter the person&apos;s email address. They&apos;ll be immediately approved for future
                  bookings.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bulk-import">
              <AccordionTrigger>How do I import emails in bulk?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Pro+ users can use CSV import. Go to the Allowlist page, click &quot;Import CSV&quot;,
                  and upload a CSV file with email addresses. Duplicates are automatically skipped and
                  invalid emails are reported.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="export-allowlist">
              <AccordionTrigger>How do I export my allowlist?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  On the Allowlist page, click &quot;Export CSV&quot; to download all your allowlist
                  entries as a CSV file including email, name, notes, and date added.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notification-settings">
              <AccordionTrigger>How do I change my email notification settings?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Go to Settings from the dashboard sidebar. Under Email Preferences, toggle
                  notifications for approved bookings, rejected bookings, and trial warnings.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="setup-webhook">
              <AccordionTrigger>How do I set up the Calendly webhook?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  In your Calendly account, go to Integrations &gt; Webhooks. Create a new webhook
                  subscription with the URL{' '}
                  <code className="text-sm bg-muted px-1 py-0.5 rounded">
                    https://prical.com/api/webhooks/calendly
                  </code>{' '}
                  and select the &quot;invitee.created&quot; event. PriCal will start receiving booking
                  notifications immediately.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Section 3: Pricing FAQ */}
          <h2 className="text-2xl font-semibold mt-12 mb-4">Pricing FAQ</h2>
          <Accordion type="multiple">
            <AccordionItem value="free-plan">
              <AccordionTrigger>Is there a free plan?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Yes. The Free plan includes basic allowlist management and booking protection. Upgrade
                  to Pro for CSV import, extended audit logs, and priority support.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="free-trial">
              <AccordionTrigger>How does the free trial work?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  New accounts start with a 14-day Pro trial. You get full access to all Pro features
                  during the trial. When it ends, your account moves to the Free plan unless you
                  subscribe.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="upgrade-cancel">
              <AccordionTrigger>How do I upgrade or cancel my subscription?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Go to Settings from the dashboard sidebar. Click &quot;Manage Subscription&quot; to
                  upgrade, downgrade, or cancel through our secure Stripe billing portal.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payment-methods">
              <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  We accept all major credit and debit cards through Stripe. All payments are processed
                  securely.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Section 4: Troubleshooting */}
          <h2 className="text-2xl font-semibold mt-12 mb-4">Troubleshooting</h2>
          <Accordion type="multiple">
            <AccordionItem value="bookings-not-screened">
              <AccordionTrigger>Why aren&apos;t my bookings being screened?</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Check three things:
                  <ol>
                    <li>
                      Your Calendly webhook is correctly configured and pointing to PriCal.
                    </li>
                    <li>Your allowlist has at least one email entry.</li>
                    <li>
                      Your account is active (not an expired trial with no subscription).
                    </li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="booking-still-cancelled">
              <AccordionTrigger>
                I added someone to my allowlist but their booking was still cancelled
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Allowlist changes apply to future bookings only. If the booking was already processed
                  before you added the email, it cannot be automatically restored. Ask the person to
                  rebook.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="no-email-notifications">
              <AccordionTrigger>I&apos;m not receiving email notifications</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Check your email notification settings in Settings &gt; Email Preferences. Make sure
                  the relevant notification types are enabled. Also check your spam/junk folder.
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="csv-import-failed">
              <AccordionTrigger>My CSV import failed</AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-slate prose-sm">
                  Ensure your CSV file has one email per row (or an &quot;email&quot; column header).
                  Check that emails are valid formats. The maximum supported file is 500 rows. CSV import
                  requires a Pro+ plan.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

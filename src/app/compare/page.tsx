import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Shield, CheckCircle, X } from 'lucide-react'

export const metadata: Metadata = {
  title: 'PriCal vs Manual Calendly Management | PriCal',
  description: 'Compare PriCal automated booking protection against managing your Calendly manually',
}

const features = [
  {
    name: 'Automatic booking screening',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'No' },
  },
  {
    name: 'Email allowlist management',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'Spreadsheet or memory' },
  },
  {
    name: 'Instant cancellation of unauthorized bookings',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'Manual review required' },
  },
  {
    name: 'Activity log of all booking decisions',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'No' },
  },
  {
    name: 'Email notifications for approved/rejected bookings',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'No' },
  },
  {
    name: 'CSV import/export of allowlist',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'N/A' },
  },
  {
    name: 'Works 24/7 without intervention',
    prical: { supported: true, label: 'Yes' },
    manual: { supported: false, label: 'No' },
  },
  {
    name: 'Guest email checking',
    prical: { supported: true, label: 'Configurable modes' },
    manual: { supported: false, label: 'Not possible' },
  },
]

export default function ComparisonPage() {
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
            <a href="/api/auth/calendly">
              <Button variant="ghost">Sign In</Button>
            </a>
            <a href="/api/auth/calendly">
              <Button>Get Started</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="container py-16">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
            PriCal vs. Manual Calendly Management
          </h1>
          <p className="text-xl text-muted-foreground">
            See how automated booking protection stacks up against managing your Calendly allowlist by hand.
          </p>
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-4xl mx-auto mb-24 overflow-x-auto">
          <table className="w-full border border-border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-4 font-semibold text-sm border-b border-border">Feature</th>
                <th className="text-center p-4 font-semibold text-sm border-b border-l border-border w-32">
                  PriCal
                </th>
                <th className="text-center p-4 font-semibold text-sm border-b border-l border-border w-48">
                  Manual
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={feature.name} className={index % 2 === 1 ? 'bg-muted/50' : ''}>
                  <td className="p-4 text-sm border-b border-border">{feature.name}</td>
                  <td className="p-4 text-center border-b border-l border-border">
                    {feature.prical.supported ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-700">{feature.prical.label}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <X className="h-4 w-4 text-destructive flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature.prical.label}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center border-b border-l border-border">
                    {feature.manual.supported ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-700">{feature.manual.label}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <X className="h-4 w-4 text-destructive flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature.manual.label}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Time Savings Narrative */}
        <div className="max-w-3xl mx-auto mb-24">
          <h2 className="text-3xl font-bold text-center mb-10">Save Hours Every Week</h2>

          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p>
              Without PriCal, every booking that lands on your calendar requires manual attention. You check
              the invitee&apos;s email, cross-reference it against wherever you keep your approved list, decide
              whether to keep or cancel the meeting, and then act. Miss one, and an unauthorized meeting slips
              through. Do it for ten bookings a week and you&apos;ve just spent real time on calendar
              administration instead of your actual work.
            </p>
            <p>
              With PriCal, you set up your allowlist once. From that point on, every booking is checked
              automatically the moment it arrives — no manual review, no spreadsheets, no mental overhead.
              Bookings from approved contacts go through; unauthorized ones are cancelled instantly and
              silently. You only hear about it if you want to.
            </p>
            <p>
              The result is a calendar that reflects your actual priorities. Instead of spending energy on
              who <em>shouldn&apos;t</em> be on your calendar, you spend it on the meetings that matter — with
              the right people, at the right time.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-16">
          <h2 className="text-3xl font-bold mb-4">Ready to protect your calendar?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Connect your Calendly account in minutes and let PriCal handle the rest. 14-day free trial,
            no credit card required.
          </p>
          <a href="/api/auth/calendly">
            <Button size="lg">Get Started Free</Button>
          </a>
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

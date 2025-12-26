import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Calendar, CheckCircle, Zap } from 'lucide-react'
import { getCurrentUser } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const user = await getCurrentUser()
  
  if (user) {
    redirect('/dashboard')
  }

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

      {/* Hero Section */}
      <section className="container py-24 md:py-32">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Secure your Calendly links and let us do the heavy lifting
            </h1>
            <p className="text-xl text-muted-foreground max-w-[600px]">
              PriCal will automatically cancel meetings that are not on your
              approved list. Protect your calendar. Only meet with people who matter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/api/auth/calendly">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              14-day free trial · No credit card required
            </p>
          </div>
          <div className="relative h-[400px] lg:h-[500px] animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-2xl" />
            <div className="absolute inset-4 bg-card rounded-xl shadow-2xl border flex items-center justify-center">
              <Calendar className="h-32 w-32 text-muted-foreground/30" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/50 py-24">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-16">How PriCal Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: 'Connect',
                description: 'Connect your Calendly Account to PriCal and automatically create your account.',
                icon: Zap,
                delay: '0s',
              },
              {
                title: 'Authorize',
                description: 'Tell PriCal who is allowed to schedule meetings with you. List out the email addresses and let PriCal do the work.',
                icon: CheckCircle,
                delay: '0.1s',
              },
              {
                title: 'Rest Easy',
                description: 'Rest easy knowing that PriCal protects your calendar by automatically canceling meetings with unauthorized users.',
                icon: Shield,
                delay: '0.2s',
              },
            ].map((step, index) => (
              <Card 
                key={step.title} 
                className="card-hover animate-fade-in"
                style={{ animationDelay: step.delay }}
              >
                <CardContent className="pt-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">Why People Choose PriCal</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            From executives to educators, PriCal helps professionals take control of their calendars.
          </p>
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                title: 'Executive Leadership',
                description: "Many leaders hesitate to use Calendly because they don't want a public facing link that allows anyone to book with them. With PriCal, they can set up their list of approved users and schedule easy knowing that unimportant meetings won't slide into their limited availability.",
              },
              {
                title: 'Customer Experience',
                description: 'When support teams work with customers, they can provide a Calendly link to help fix a specific issue. In some cases, customers continue using that link to book meetings for help - even if processes have changed.',
              },
              {
                title: 'Education',
                description: 'Teachers and professors can limit their availability to only their current classes or to current parents of their students.',
              },
            ].map((useCase) => (
              <Card key={useCase.title} className="card-hover">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold mb-3">{useCase.title}</h3>
                  <p className="text-muted-foreground">{useCase.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="bg-muted/50 py-24">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            Start free, upgrade when you need more.
          </p>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                name: 'Free',
                price: '$0',
                description: 'For individuals getting started',
                features: ['25 allowlist entries', '1 event type', '30-day activity log', 'Basic support'],
              },
              {
                name: 'Pro',
                price: '$9',
                period: '/month',
                description: 'For professionals who need more',
                features: ['500 allowlist entries', 'Unlimited event types', '90-day activity log', 'CSV import', 'Priority support'],
                highlighted: true,
              },
              {
                name: 'Business',
                price: '$29',
                period: '/month',
                description: 'For teams and power users',
                features: ['2,000 allowlist entries', 'Unlimited event types', '365-day activity log', 'Team members', 'Advanced analytics'],
              },
            ].map((plan) => (
              <Card 
                key={plan.name} 
                className={`card-hover ${plan.highlighted ? 'border-primary shadow-lg' : ''}`}
              >
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-success mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/api/auth/calendly" className="block mt-6">
                    <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="rounded-2xl bg-primary p-12 text-center text-primary-foreground">
            <h2 className="text-3xl font-bold mb-4">Take the Meetings That Matter</h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of professionals who protect their calendars with PriCal.
            </p>
            <Link href="/api/auth/calendly">
              <Button size="lg" variant="secondary">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">PriCal</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PriCal. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}



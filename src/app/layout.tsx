import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { QueryProvider } from '@/components/providers/query-provider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'PriCal - Protect Your Calendar',
  description: 'Automatically cancel unauthorized Calendly bookings. Only meet with people who matter.',
  keywords: ['calendly', 'calendar', 'scheduling', 'access control', 'allowlist'],
  authors: [{ name: 'PriCal Team' }],
  openGraph: {
    title: 'PriCal - Protect Your Calendar',
    description: 'Automatically cancel unauthorized Calendly bookings. Only meet with people who matter.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}




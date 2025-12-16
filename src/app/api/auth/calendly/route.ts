import { NextResponse } from 'next/server'
import { getCalendlyAuthUrl } from '@/lib/calendly'
import crypto from 'crypto'

export async function GET() {
  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')
  
  // In production, you'd want to store this state in a session or cookie
  // to verify it when the callback comes back
  
  const authUrl = getCalendlyAuthUrl(state)
  
  return NextResponse.redirect(authUrl)
}


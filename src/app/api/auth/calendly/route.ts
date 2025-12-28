import { NextResponse } from 'next/server'
import { getCalendlyAuthUrl } from '@/lib/calendly'
import crypto from 'crypto'

/**
 * @swagger
 * /api/auth/calendly:
 *   get:
 *     summary: Start OAuth flow
 *     description: Redirects the user to Calendly's OAuth authorization page to begin authentication
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to Calendly OAuth page
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               format: uri
 *             description: Calendly OAuth authorization URL
 */
export async function GET() {
  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')
  
  // In production, you'd want to store this state in a session or cookie
  // to verify it when the callback comes back
  
  const authUrl = getCalendlyAuthUrl(state)
  
  return NextResponse.redirect(authUrl)
}



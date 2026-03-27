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
  console.log('[CALENDLY AUTH] === Starting OAuth flow ===')

  // Generate a random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')
  console.log('[CALENDLY AUTH] Generated state:', state)

  const authUrl = getCalendlyAuthUrl(state)
  console.log('[CALENDLY AUTH] Redirecting to auth URL:', authUrl)

  return NextResponse.redirect(authUrl)
}



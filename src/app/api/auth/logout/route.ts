import { NextResponse } from 'next/server'
import { getSession, getCurrentUser } from '@/lib/session'
import { getPostHogServer } from '@/lib/posthog-server'

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout (API)
 *     description: Destroys the user's session and logs them out
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
export async function POST() {
  const user = await getCurrentUser()
  const session = await getSession()

  if (user) {
    const ph = getPostHogServer()
    ph.capture({ distinctId: user.id, event: 'logout', properties: { source: 'api' } })
    await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
  }

  session.destroy()
  return NextResponse.json({ success: true })
}

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     summary: Logout (Redirect)
 *     description: Destroys the user's session and redirects to the home page
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to home page after logout
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               format: uri
 */
export async function GET() {
  const user = await getCurrentUser()
  const session = await getSession()

  if (user) {
    const ph = getPostHogServer()
    ph.capture({ distinctId: user.id, event: 'logout', properties: { source: 'redirect' } })
    await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
  }

  session.destroy()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return NextResponse.redirect(appUrl)
}

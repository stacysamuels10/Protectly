import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

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
  const session = await getSession()
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
  const session = await getSession()
  session.destroy()
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return NextResponse.redirect(appUrl)
}



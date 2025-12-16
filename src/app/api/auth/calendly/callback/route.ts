import { NextRequest, NextResponse } from 'next/server'
import { 
  exchangeCodeForTokens, 
  getCalendlyUser, 
  createWebhookSubscription 
} from '@/lib/calendly'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error) {
    console.error('Calendly OAuth error:', error)
    return NextResponse.redirect(`${appUrl}/?error=oauth_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=no_code`)
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    
    // Get user info from Calendly
    const calendlyUser = await getCalendlyUser(tokens.access_token)
    
    // Find or create user in our database
    let user = await prisma.user.findFirst({
      where: { calendlyUserUri: calendlyUser.uri },
    })

    if (!user) {
      // Create new user with 14-day Pro trial
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)

      user = await prisma.user.create({
        data: {
          email: calendlyUser.email,
          name: calendlyUser.name,
          avatarUrl: calendlyUser.avatar_url,
          calendlyAccessToken: tokens.access_token,
          calendlyRefreshToken: tokens.refresh_token,
          calendlyUserUri: calendlyUser.uri,
          calendlyOrganizationUri: calendlyUser.current_organization,
          subscriptionTier: 'PRO',
          subscriptionStatus: 'TRIALING',
          trialEndsAt,
        },
      })

      // Create default global allowlist for the user
      await prisma.allowlist.create({
        data: {
          userId: user.id,
          name: 'My Allowlist',
          isGlobal: true,
        },
      })

      // Create webhook subscription for the user
      try {
        const webhookUrl = process.env.WEBHOOK_URL || `${appUrl}/api/webhooks/calendly`
        
        await createWebhookSubscription(
          tokens.access_token,
          calendlyUser.current_organization,
          calendlyUser.uri,
          webhookUrl
        )
      } catch (webhookError) {
        console.error('Failed to create webhook subscription:', webhookError)
        // Continue anyway - user can retry later
      }
    } else {
      // Update existing user's tokens
      await prisma.user.update({
        where: { id: user.id },
        data: {
          calendlyAccessToken: tokens.access_token,
          calendlyRefreshToken: tokens.refresh_token,
          name: calendlyUser.name,
          avatarUrl: calendlyUser.avatar_url,
        },
      })
    }

    // Create session
    const session = await getSession()
    session.userId = user.id
    session.isLoggedIn = true
    await session.save()

    return NextResponse.redirect(`${appUrl}/dashboard`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`)
  }
}


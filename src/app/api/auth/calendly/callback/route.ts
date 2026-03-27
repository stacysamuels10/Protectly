import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getCalendlyUser,
  createWebhookSubscription,
} from "@/lib/calendly";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { getPostHogServer } from "@/lib/posthog-server";

export async function GET(request: NextRequest) {
  console.log('[CALENDLY CALLBACK] === OAuth callback received ===')
  console.log('[CALENDLY CALLBACK] Full URL:', request.nextUrl.toString())

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log('[CALENDLY CALLBACK] Params - code:', code ? code.substring(0, 10) + '...' : 'MISSING')
  console.log('[CALENDLY CALLBACK] Params - error:', error)
  console.log('[CALENDLY CALLBACK] Params - error_description:', errorDescription)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log('[CALENDLY CALLBACK] App URL:', appUrl)

  if (error) {
    console.error('[CALENDLY CALLBACK] OAuth error from Calendly:', error, errorDescription)
    logger.error({ err: error, action: 'oauth_exchange' }, 'calendly OAuth token exchange failed')
    return NextResponse.redirect(`${appUrl}/?error=oauth_failed`);
  }

  if (!code) {
    console.error('[CALENDLY CALLBACK] No authorization code in callback URL')
    return NextResponse.redirect(`${appUrl}/?error=no_code`);
  }

  try {
    // Exchange code for tokens
    console.log('[CALENDLY CALLBACK] Step 1: Exchanging code for tokens...')
    console.log('[CALENDLY CALLBACK] CALENDLY_CLIENT_ID:', process.env.CALENDLY_CLIENT_ID?.substring(0, 8) + '...')
    console.log('[CALENDLY CALLBACK] CALENDLY_REDIRECT_URI:', process.env.CALENDLY_REDIRECT_URI)
    console.log('[CALENDLY CALLBACK] CALENDLY_CLIENT_SECRET set:', !!process.env.CALENDLY_CLIENT_SECRET)

    const tokens = await exchangeCodeForTokens(code);
    console.log('[CALENDLY CALLBACK] Step 1 SUCCESS: Got tokens')
    console.log('[CALENDLY CALLBACK] Token type:', tokens.token_type)
    console.log('[CALENDLY CALLBACK] Expires in:', tokens.expires_in, 'seconds')
    console.log('[CALENDLY CALLBACK] Owner:', tokens.owner)
    console.log('[CALENDLY CALLBACK] Organization:', tokens.organization)

    // Get user info from Calendly
    console.log('[CALENDLY CALLBACK] Step 2: Fetching Calendly user info...')
    const calendlyUser = await getCalendlyUser(tokens.access_token);
    console.log('[CALENDLY CALLBACK] Step 2 SUCCESS: Got user info')
    console.log('[CALENDLY CALLBACK] User email:', calendlyUser.email)
    console.log('[CALENDLY CALLBACK] User name:', calendlyUser.name)
    console.log('[CALENDLY CALLBACK] User URI:', calendlyUser.uri)
    console.log('[CALENDLY CALLBACK] Organization:', calendlyUser.current_organization)

    // Find or create user in our database
    console.log('[CALENDLY CALLBACK] Step 3: Looking up user in database by URI:', calendlyUser.uri)
    let user = await prisma.user.findFirst({
      where: { calendlyUserUri: calendlyUser.uri },
    });
    console.log('[CALENDLY CALLBACK] Existing user found:', !!user, user ? `(id: ${user.id})` : '')

    const webhookUrl =
      process.env.WEBHOOK_URL || `${appUrl}/api/webhooks/calendly`;
    console.log('[CALENDLY CALLBACK] Webhook URL:', webhookUrl)
    logger.info({ action: 'oauth_callback' }, 'webhook URL configured')

    if (!user) {
      console.log('[CALENDLY CALLBACK] Step 3a: Creating NEW user with 14-day Pro trial...')
      // Create new user with 14-day Pro trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      user = await prisma.user.create({
        data: {
          email: calendlyUser.email,
          name: calendlyUser.name,
          avatarUrl: calendlyUser.avatar_url,
          calendlyAccessToken: encrypt(tokens.access_token),
          calendlyRefreshToken: encrypt(tokens.refresh_token),
          calendlyUserUri: calendlyUser.uri,
          calendlyOrganizationUri: calendlyUser.current_organization,
          subscriptionTier: "PRO",
          subscriptionStatus: "TRIALING",
          trialEndsAt,
        },
      });
      console.log('[CALENDLY CALLBACK] Step 3a SUCCESS: Created user id:', user.id)

      // Create default global allowlist for the user
      console.log('[CALENDLY CALLBACK] Creating default allowlist...')
      await prisma.allowlist.create({
        data: {
          userId: user.id,
          name: "My Allowlist",
          isGlobal: true,
        },
      });
      console.log('[CALENDLY CALLBACK] Default allowlist created')

      logger.info({ userId: user.id, action: 'signup' }, 'new user created')
      const ph = getPostHogServer()
      ph?.capture({ distinctId: user.id, event: 'signup', properties: { source: 'calendly_oauth' } })
      if (ph) await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
    } else {
      console.log('[CALENDLY CALLBACK] Step 3b: Updating EXISTING user tokens for id:', user.id)
      // Update existing user's tokens
      await prisma.user.update({
        where: { id: user.id },
        data: {
          calendlyAccessToken: encrypt(tokens.access_token),
          calendlyRefreshToken: encrypt(tokens.refresh_token),
          name: calendlyUser.name,
          avatarUrl: calendlyUser.avatar_url,
        },
      });
      console.log('[CALENDLY CALLBACK] Step 3b SUCCESS: User tokens updated')

      logger.info({ userId: user.id, action: 'login' }, 'existing user updated')
      const ph = getPostHogServer()
      ph?.capture({ distinctId: user.id, event: 'login', properties: { source: 'calendly_oauth' } })
      if (ph) await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
    }

    // Always try to create/update webhook subscription on login
    console.log('[CALENDLY CALLBACK] Step 4: Creating webhook subscription...')
    try {
      logger.info({ userId: user.id, action: 'webhook_setup' }, 'creating webhook subscription')
      const webhookResult = await createWebhookSubscription(
        tokens.access_token,
        calendlyUser.current_organization,
        calendlyUser.uri,
        webhookUrl
      );
      console.log('[CALENDLY CALLBACK] Step 4 SUCCESS: Webhook created')
      logger.info({ userId: user.id, action: 'webhook_setup' }, 'webhook subscription created')
      void webhookResult
    } catch (webhookError: any) {
      // 409 Conflict means webhook already exists - that's fine
      if (webhookError?.response?.status === 409) {
        console.log('[CALENDLY CALLBACK] Step 4: Webhook already exists (409) - OK')
        logger.info({ userId: user.id, action: 'webhook_setup' }, 'webhook subscription already exists')
      } else {
        console.error('[CALENDLY CALLBACK] Step 4 FAILED: Webhook creation error:', webhookError?.message, 'Status:', webhookError?.response?.status)
        logger.error({ err: webhookError, userId: user.id, action: 'webhook_setup' }, 'failed to create webhook subscription')
      }
    }

    // Create session
    console.log('[CALENDLY CALLBACK] Step 5: Creating session for user:', user.id)
    const session = await getSession();
    session.userId = user.id;
    session.isLoggedIn = true;
    await session.save();
    console.log('[CALENDLY CALLBACK] Step 5 SUCCESS: Session saved')

    console.log('[CALENDLY CALLBACK] === OAuth flow COMPLETE - redirecting to dashboard ===')
    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (error: any) {
    console.error('[CALENDLY CALLBACK] === OAuth callback FAILED ===')
    console.error('[CALENDLY CALLBACK] Error message:', error?.message)
    console.error('[CALENDLY CALLBACK] Error status:', error?.response?.status)
    console.error('[CALENDLY CALLBACK] Error stack:', error?.stack)
    logger.error({ err: error, action: 'oauth_callback' }, 'OAuth callback failed')
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}

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
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    logger.error({ err: error, action: 'oauth_exchange' }, 'calendly OAuth token exchange failed')
    return NextResponse.redirect(`${appUrl}/?error=oauth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Calendly
    const calendlyUser = await getCalendlyUser(tokens.access_token);

    // Find or create user in our database
    let user = await prisma.user.findFirst({
      where: { calendlyUserUri: calendlyUser.uri },
    });

    const webhookUrl =
      process.env.WEBHOOK_URL || `${appUrl}/api/webhooks/calendly`;
    logger.info({ action: 'oauth_callback' }, 'webhook URL configured')

    if (!user) {
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

      // Create default global allowlist for the user
      await prisma.allowlist.create({
        data: {
          userId: user.id,
          name: "My Allowlist",
          isGlobal: true,
        },
      });

      logger.info({ userId: user.id, action: 'signup' }, 'new user created')
      const ph = getPostHogServer()
      ph.capture({ distinctId: user.id, event: 'signup', properties: { source: 'calendly_oauth' } })
      await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
    } else {
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

      logger.info({ userId: user.id, action: 'login' }, 'existing user updated')
      const ph = getPostHogServer()
      ph.capture({ distinctId: user.id, event: 'login', properties: { source: 'calendly_oauth' } })
      await Promise.race([ph.shutdown(), new Promise(resolve => setTimeout(resolve, 2000))])
    }

    // Always try to create/update webhook subscription on login
    try {
      logger.info({ userId: user.id, action: 'webhook_setup' }, 'creating webhook subscription')
      const webhookResult = await createWebhookSubscription(
        tokens.access_token,
        calendlyUser.current_organization,
        calendlyUser.uri,
        webhookUrl
      );
      logger.info({ userId: user.id, action: 'webhook_setup' }, 'webhook subscription created')
      void webhookResult
    } catch (webhookError: any) {
      // 409 Conflict means webhook already exists - that's fine
      if (webhookError?.response?.status === 409) {
        logger.info({ userId: user.id, action: 'webhook_setup' }, 'webhook subscription already exists')
      } else {
        logger.error({ err: webhookError, userId: user.id, action: 'webhook_setup' }, 'failed to create webhook subscription')
      }
    }

    // Create session
    const session = await getSession();
    session.userId = user.id;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (error) {
    logger.error({ err: error, action: 'oauth_callback' }, 'OAuth callback failed')
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }
}

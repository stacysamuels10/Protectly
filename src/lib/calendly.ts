import { env } from '@/env'
import { encrypt, decrypt } from '@/lib/encryption'
import { logger } from '@/lib/logger'

const CALENDLY_API_BASE_URL = "https://api.calendly.com";
const CALENDLY_AUTH_BASE_URL = "https://auth.calendly.com";

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  current_organization: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
  duration: number;
  kind: string;
  pooling_type: string | null;
  type: string;
  color: string;
  created_at: string;
  updated_at: string;
  internal_note: string | null;
  description_plain: string | null;
  description_html: string | null;
  profile: {
    type: string;
    name: string;
    owner: string;
  };
  secret: boolean;
  booking_method: string;
  custom_questions: Array<{
    name: string;
    type: string;
    position: number;
    enabled: boolean;
    required: boolean;
    answer_choices: string[];
    include_other: boolean;
  }>;
}

export interface CalendlyWebhookPayload {
  event: "invitee.created" | "invitee.canceled";
  created_at: string;
  created_by: string;
  payload: {
    cancel_url: string;
    created_at: string;
    email: string;
    event: string;
    name: string;
    new_invitee: string | null;
    old_invitee: string | null;
    questions_and_answers: Array<{
      answer: string;
      position: number;
      question: string;
    }>;
    reschedule_url: string;
    rescheduled: boolean;
    routing_form_submission: string | null;
    status: string;
    text_reminder_number: string | null;
    timezone: string;
    tracking: {
      utm_campaign: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_content: string | null;
      utm_term: string | null;
      salesforce_uuid: string | null;
    };
    updated_at: string;
    uri: string;
    scheduled_event: {
      uri: string;
      name: string;
      status: string;
      start_time: string;
      end_time: string;
      event_type: string;
      location: {
        type: string;
        location: string | null;
      };
      invitees_counter: {
        total: number;
        active: number;
        limit: number;
      };
      created_at: string;
      updated_at: string;
      event_memberships: Array<{
        user: string;
        user_email: string;
        user_name: string;
      }>;
      event_guests: Array<{
        email: string;
        created_at: string;
        updated_at: string;
      }>;
    };
  };
}

// OAuth functions
export function getCalendlyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.CALENDLY_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.CALENDLY_REDIRECT_URI,
    state,
  });

  return `${CALENDLY_AUTH_BASE_URL}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  console.log('[CALENDLY TOKEN] Exchanging code for tokens...')
  console.log('[CALENDLY TOKEN] Auth URL:', `${CALENDLY_AUTH_BASE_URL}/oauth/token`)
  console.log('[CALENDLY TOKEN] Client ID:', env.CALENDLY_CLIENT_ID?.substring(0, 8) + '...')
  console.log('[CALENDLY TOKEN] Redirect URI:', env.CALENDLY_REDIRECT_URI)
  console.log('[CALENDLY TOKEN] Code (first 10):', code?.substring(0, 10))

  const response = await fetch(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: env.CALENDLY_CLIENT_ID,
      client_secret: env.CALENDLY_CLIENT_SECRET,
      redirect_uri: env.CALENDLY_REDIRECT_URI,
    }),
    cache: 'no-store',
  });

  console.log('[CALENDLY TOKEN] Response status:', response.status, response.statusText)

  if (!response.ok) {
    const body = await response.text();
    console.error('[CALENDLY TOKEN] FAILED - Status:', response.status)
    console.error('[CALENDLY TOKEN] FAILED - Response body:', body)
    const error: any = new Error(`HTTP ${response.status}: ${body}`);
    error.response = { status: response.status };
    throw error;
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
    owner: string;
    organization: string;
  };
  console.log('[CALENDLY TOKEN] SUCCESS - token_type:', data.token_type, 'expires_in:', data.expires_in)
  return data;
}

export async function refreshAccessToken(refreshToken: string) {
  console.log('[CALENDLY REFRESH] Refreshing access token...')
  const response = await fetch(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.CALENDLY_CLIENT_ID,
      client_secret: env.CALENDLY_CLIENT_SECRET,
    }),
    cache: 'no-store',
  });

  console.log('[CALENDLY REFRESH] Response status:', response.status, response.statusText)

  if (!response.ok) {
    const body = await response.text();
    console.error('[CALENDLY REFRESH] FAILED - Status:', response.status)
    console.error('[CALENDLY REFRESH] FAILED - Response body:', body)
    const error: any = new Error(`HTTP ${response.status}: ${body}`);
    error.response = { status: response.status };
    throw error;
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
  };
  console.log('[CALENDLY REFRESH] SUCCESS - new token obtained')
  return data;
}

// API functions
export async function getCalendlyUser(
  accessToken: string
): Promise<CalendlyUser> {
  console.log('[CALENDLY USER] Fetching /users/me...')
  const response = await fetch(`${CALENDLY_API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  console.log('[CALENDLY USER] Response status:', response.status, response.statusText)

  if (!response.ok) {
    const body = await response.text();
    console.error('[CALENDLY USER] FAILED - Status:', response.status)
    console.error('[CALENDLY USER] FAILED - Response body:', body)
    const error: any = new Error(`HTTP ${response.status}: ${body}`);
    error.response = { status: response.status };
    throw error;
  }

  const data = await response.json();
  console.log('[CALENDLY USER] SUCCESS - email:', data.resource?.email, 'uri:', data.resource?.uri)
  return data.resource as CalendlyUser;
}

export async function getEventTypes(
  accessToken: string,
  userUri: string
): Promise<CalendlyEventType[]> {
  const params = new URLSearchParams({ user: userUri, active: 'true' });
  const response = await fetch(`${CALENDLY_API_BASE_URL}/event_types?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error: any = new Error(`HTTP ${response.status}`);
    error.response = { status: response.status };
    throw error;
  }

  const data = await response.json();
  return data.collection as CalendlyEventType[];
}

export async function createWebhookSubscription(
  accessToken: string,
  organizationUri: string,
  userUri: string,
  webhookUrl: string
) {
  console.log('[CALENDLY WEBHOOK] Creating webhook subscription...')
  console.log('[CALENDLY WEBHOOK] URL:', webhookUrl)
  console.log('[CALENDLY WEBHOOK] Organization:', organizationUri)
  console.log('[CALENDLY WEBHOOK] User:', userUri)

  const response = await fetch(`${CALENDLY_API_BASE_URL}/webhook_subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created"],
      organization: organizationUri,
      user: userUri,
      scope: "user",
    }),
    cache: 'no-store',
  });

  console.log('[CALENDLY WEBHOOK] Response status:', response.status, response.statusText)

  if (!response.ok) {
    const body = await response.text();
    console.error('[CALENDLY WEBHOOK] FAILED - Status:', response.status)
    console.error('[CALENDLY WEBHOOK] FAILED - Response body:', body)
    const error: any = new Error(`HTTP ${response.status}: ${body}`);
    error.response = { status: response.status };
    throw error;
  }

  const data = await response.json();
  console.log('[CALENDLY WEBHOOK] SUCCESS - webhook created')
  return data.resource as {
    uri: string;
    callback_url: string;
    created_at: string;
    updated_at: string;
    retry_started_at: string | null;
    state: string;
    events: string[];
    scope: string;
    organization: string;
    user: string;
    creator: string;
  };
}

export async function deleteWebhookSubscription(
  accessToken: string,
  webhookUri: string
) {
  const response = await fetch(webhookUri, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error: any = new Error(`HTTP ${response.status}`);
    error.response = { status: response.status };
    throw error;
  }
}

export async function cancelCalendlyEvent(
  accessToken: string,
  eventUri: string,
  reason: string
) {
  const cancelUrl = `${eventUri}/cancellation`;
  logger.info({ eventUri, action: 'cancel_event' }, 'cancelling calendly event')

  try {
    const response = await fetch(cancelUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}`);
      error.response = { status: response.status };
      throw error;
    }

    const data = await response.json();
    logger.info({ status: response.status, action: 'cancel_event' }, 'cancel response received')
    logger.info({ action: 'cancel_event' }, 'cancel response data received')
    return data;
  } catch (error: any) {
    logger.error({ err: error, action: 'cancel_event' }, 'cancel request failed')
    throw error;
  }
}

// Helper to make authenticated requests with automatic token refresh
export async function calendlyRequest<T>(
  userId: string,
  requestFn: (accessToken: string) => Promise<T>
): Promise<T> {
  const { prisma } = await import("./prisma");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calendlyAccessToken: true,
      calendlyRefreshToken: true,
    },
  });

  if (!user?.calendlyAccessToken || !user?.calendlyRefreshToken) {
    throw new Error("User not connected to Calendly");
  }

  // Decrypt tokens before use — convert crypto errors to a user-friendly message
  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decrypt(user.calendlyAccessToken);
    refreshToken = decrypt(user.calendlyRefreshToken);
  } catch {
    throw new Error("User not connected to Calendly");
  }

  try {
    return await requestFn(accessToken);
  } catch (error: any) {
    // If 401, try to refresh the token
    if (error.response?.status === 401) {
      const newTokens = await refreshAccessToken(refreshToken);

      // Encrypt new tokens before writing back to the database
      await prisma.user.update({
        where: { id: userId },
        data: {
          calendlyAccessToken: encrypt(newTokens.access_token),
          calendlyRefreshToken: encrypt(newTokens.refresh_token),
        },
      });

      // Retry the request with the new plaintext token
      return await requestFn(newTokens.access_token);
    }

    throw error;
  }
}

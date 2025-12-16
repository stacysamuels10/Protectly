import axios from 'axios'

const CALENDLY_API_BASE_URL = 'https://api.calendly.com'
const CALENDLY_AUTH_BASE_URL = 'https://auth.calendly.com'

export interface CalendlyUser {
  uri: string
  name: string
  email: string
  scheduling_url: string
  timezone: string
  avatar_url: string | null
  created_at: string
  updated_at: string
  current_organization: string
}

export interface CalendlyEventType {
  uri: string
  name: string
  active: boolean
  slug: string
  scheduling_url: string
  duration: number
  kind: string
  pooling_type: string | null
  type: string
  color: string
  created_at: string
  updated_at: string
  internal_note: string | null
  description_plain: string | null
  description_html: string | null
  profile: {
    type: string
    name: string
    owner: string
  }
  secret: boolean
  booking_method: string
  custom_questions: Array<{
    name: string
    type: string
    position: number
    enabled: boolean
    required: boolean
    answer_choices: string[]
    include_other: boolean
  }>
}

export interface CalendlyWebhookPayload {
  event: 'invitee.created' | 'invitee.canceled'
  created_at: string
  created_by: string
  payload: {
    cancel_url: string
    created_at: string
    email: string
    event: string
    name: string
    new_invitee: string | null
    old_invitee: string | null
    questions_and_answers: Array<{
      answer: string
      position: number
      question: string
    }>
    reschedule_url: string
    rescheduled: boolean
    routing_form_submission: string | null
    status: string
    text_reminder_number: string | null
    timezone: string
    tracking: {
      utm_campaign: string | null
      utm_source: string | null
      utm_medium: string | null
      utm_content: string | null
      utm_term: string | null
      salesforce_uuid: string | null
    }
    updated_at: string
    uri: string
    scheduled_event: {
      uri: string
      name: string
      status: string
      start_time: string
      end_time: string
      event_type: string
      location: {
        type: string
        location: string | null
      }
      invitees_counter: {
        total: number
        active: number
        limit: number
      }
      created_at: string
      updated_at: string
      event_memberships: Array<{
        user: string
        user_email: string
        user_name: string
      }>
      event_guests: Array<{
        email: string
        created_at: string
        updated_at: string
      }>
    }
  }
}

// OAuth functions
export function getCalendlyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.CALENDLY_REDIRECT_URI!,
    state,
  })

  return `${CALENDLY_AUTH_BASE_URL}/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string) {
  const response = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.CALENDLY_CLIENT_ID,
    client_secret: process.env.CALENDLY_CLIENT_SECRET,
    redirect_uri: process.env.CALENDLY_REDIRECT_URI,
  })

  return response.data as {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    created_at: number
    owner: string
    organization: string
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.CALENDLY_CLIENT_ID,
    client_secret: process.env.CALENDLY_CLIENT_SECRET,
  })

  return response.data as {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
    created_at: number
  }
}

// API functions
export async function getCalendlyUser(accessToken: string): Promise<CalendlyUser> {
  const response = await axios.get(`${CALENDLY_API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return response.data.resource as CalendlyUser
}

export async function getEventTypes(accessToken: string, userUri: string): Promise<CalendlyEventType[]> {
  const response = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      user: userUri,
      active: true,
    },
  })

  return response.data.collection as CalendlyEventType[]
}

export async function createWebhookSubscription(
  accessToken: string,
  organizationUri: string,
  userUri: string,
  webhookUrl: string
) {
  const response = await axios.post(
    `${CALENDLY_API_BASE_URL}/webhook_subscriptions`,
    {
      url: webhookUrl,
      events: ['invitee.created'],
      organization: organizationUri,
      user: userUri,
      scope: 'user',
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return response.data.resource as {
    uri: string
    callback_url: string
    created_at: string
    updated_at: string
    retry_started_at: string | null
    state: string
    events: string[]
    scope: string
    organization: string
    user: string
    creator: string
  }
}

export async function deleteWebhookSubscription(accessToken: string, webhookUri: string) {
  await axios.delete(webhookUri, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function cancelCalendlyEvent(
  accessToken: string,
  eventUri: string,
  reason: string
) {
  const response = await axios.post(
    `${eventUri}/cancellation`,
    {
      reason,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return response.data
}

// Helper to make authenticated requests with automatic token refresh
export async function calendlyRequest<T>(
  userId: string,
  requestFn: (accessToken: string) => Promise<T>
): Promise<T> {
  const { prisma } = await import('./prisma')
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calendlyAccessToken: true,
      calendlyRefreshToken: true,
    },
  })

  if (!user?.calendlyAccessToken || !user?.calendlyRefreshToken) {
    throw new Error('User not connected to Calendly')
  }

  try {
    return await requestFn(user.calendlyAccessToken)
  } catch (error: any) {
    // If 401, try to refresh the token
    if (error.response?.status === 401) {
      const newTokens = await refreshAccessToken(user.calendlyRefreshToken)
      
      // Update tokens in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          calendlyAccessToken: newTokens.access_token,
          calendlyRefreshToken: newTokens.refresh_token,
        },
      })

      // Retry the request with new token
      return await requestFn(newTokens.access_token)
    }
    
    throw error
  }
}


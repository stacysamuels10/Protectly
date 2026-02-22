import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/env before any imports
vi.mock('@/env', () => ({
  env: {
    ENCRYPTION_KEY: 'c4a368b18b2565b06c78e885e2ed17236f83722594a6d122a4d706bf44d9b8bf',
    CALENDLY_WEBHOOK_SIGNING_KEY: 'test-signing-key',
    CALENDLY_CLIENT_ID: 'test-client-id',
    CALENDLY_CLIENT_SECRET: 'test-client-secret',
    CALENDLY_REDIRECT_URI: 'http://localhost:3000/api/auth/calendly/callback',
  },
}))

// Mock encryption module to control encrypt/decrypt behavior
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((value: string) => `enc:v1:mocked:${value}`),
  decrypt: vi.fn((envelope: string) => {
    if (envelope.startsWith('enc:v1:mocked:')) {
      return envelope.replace('enc:v1:mocked:', '')
    }
    throw new Error('Invalid encryption envelope format or unsupported version')
  }),
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

// Mock webhook verification so we can test the token path in isolation
vi.mock('@/lib/webhook', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
  isTimestampValid: vi.fn().mockReturnValue(true),
}))

// Mock calendly API functions
vi.mock('@/lib/calendly', () => ({
  cancelCalendlyEvent: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

import { encrypt, decrypt } from '@/lib/encryption'
import { cancelCalendlyEvent, refreshAccessToken } from '@/lib/calendly'
import { prisma } from '@/lib/prisma'

const mockEncrypt = vi.mocked(encrypt)
const mockDecrypt = vi.mocked(decrypt)
const mockCancelCalendlyEvent = vi.mocked(cancelCalendlyEvent)
const mockRefreshAccessToken = vi.mocked(refreshAccessToken)
const mockPrismaUserUpdate = vi.mocked(prisma.user.update)

// Helper: build a minimal cancelBookingWithRetry-compatible user object
function makeUser(accessToken: string, refreshToken: string) {
  return {
    id: 'user-123',
    calendlyAccessToken: accessToken,
    calendlyRefreshToken: refreshToken,
  }
}

// Import the function under test after all mocks are set up
// cancelBookingWithRetry is not exported — we test it via a thin helper approach:
// We directly import the module's internals by re-exporting, OR we test via the POST handler.
// Since the plan specifies testing cancelBookingWithRetry directly (it's not exported), we
// use a workaround: extract and test it by importing the route module and calling POST with
// a crafted request that reaches cancelBookingWithRetry.
//
// For cleaner testing, we'll test cancelBookingWithRetry by triggering a POST that reaches
// the cancellation path. We need prisma.user.findFirst to return a non-approved user.

// Mock prisma.user.findFirst, prisma.eventType, prisma.bookingAttempt for POST handler path
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    eventType: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    bookingAttempt: {
      create: vi.fn(),
    },
  },
}))

// Re-import prisma after updated mock
import { prisma as prismaFull } from '@/lib/prisma'
const mockPrismaUserFindFirst = vi.mocked(prismaFull.user.findFirst)
const mockPrismaUserUpdateFull = vi.mocked(prismaFull.user.update)
const mockPrismaEventTypeFindFirst = vi.mocked(prismaFull.eventType.findFirst)
const mockPrismaEventTypeCreate = vi.mocked(prismaFull.eventType.create)
const mockPrismaBookingAttemptCreate = vi.mocked(prismaFull.bookingAttempt.create)

// Build a test CalendlyWebhookPayload for invitee.created with an unapproved email
function makeWebhookPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event: 'invitee.created',
    created_at: new Date().toISOString(),
    created_by: 'https://api.calendly.com/users/abc123',
    payload: {
      cancel_url: 'https://calendly.com/cancellations/test',
      created_at: new Date().toISOString(),
      email: 'notallowed@example.com',
      event: 'https://api.calendly.com/scheduled_events/EVT001',
      name: 'Test Invitee',
      new_invitee: null,
      old_invitee: null,
      questions_and_answers: [],
      reschedule_url: 'https://calendly.com/reschedulings/test',
      rescheduled: false,
      routing_form_submission: null,
      status: 'active',
      text_reminder_number: null,
      timezone: 'UTC',
      tracking: {
        utm_campaign: null,
        utm_source: null,
        utm_medium: null,
        utm_content: null,
        utm_term: null,
        salesforce_uuid: null,
      },
      updated_at: new Date().toISOString(),
      uri: 'https://api.calendly.com/scheduled_events/EVT001/invitees/INV001',
      scheduled_event: {
        uri: 'https://api.calendly.com/scheduled_events/EVT001',
        name: '30 Minute Meeting',
        status: 'active',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        event_type: 'https://api.calendly.com/event_types/ET001',
        location: { type: 'outbound_call', location: null },
        invitees_counter: { total: 1, active: 1, limit: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        event_memberships: [],
        event_guests: [],
      },
      ...overrides,
    },
  })
}

// Build a NextRequest-compatible mock
function makeRequest(body: string) {
  return {
    text: async () => body,
    headers: {
      get: (name: string) => {
        if (name === 'calendly-webhook-signature') return 't=1234567890,v1=abc123'
        return null
      },
    },
  } as any
}

describe('cancelBookingWithRetry (via POST handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Restore default mock implementations
    mockDecrypt.mockImplementation((envelope: string) => {
      if (envelope.startsWith('enc:v1:mocked:')) {
        return envelope.replace('enc:v1:mocked:', '')
      }
      throw new Error('Invalid encryption envelope format or unsupported version')
    })
    mockEncrypt.mockImplementation((value: string) => `enc:v1:mocked:${value}`)

    // Default: event type exists
    mockPrismaEventTypeFindFirst.mockResolvedValue({
      id: 'et-001',
      calendlyEventTypeUri: 'https://api.calendly.com/event_types/ET001',
    } as any)
    mockPrismaEventTypeCreate.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaBookingAttemptCreate.mockResolvedValue({} as any)
    mockPrismaUserUpdateFull.mockResolvedValue({} as any)
  })

  it('decrypts the access token before calling cancelCalendlyEvent (happy path)', async () => {
    const encryptedAccessToken = 'enc:v1:mocked:real-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:real-refresh-token'

    // User has an empty allowlist → invitee will not be approved → cancellation triggered
    mockPrismaUserFindFirst.mockResolvedValue({
      id: 'user-123',
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
      guestCheckMode: 'STRICT',
      cancelMessage: 'Sorry, you are not on the allowlist.',
      guestCancelMessage: 'Sorry, guests not allowed.',
      allowlists: [{ entries: [] }],
    } as any)

    mockCancelCalendlyEvent.mockResolvedValue({})

    const { POST } = await import('./route')
    const request = makeRequest(makeWebhookPayload())

    // Bypass the 4-second delay in tests
    vi.useFakeTimers()
    const responsePromise = POST(request)
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await responsePromise

    // decrypt must have been called with the encrypted access token
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedAccessToken)

    // cancelCalendlyEvent must have received the decrypted value, not the envelope
    expect(mockCancelCalendlyEvent).toHaveBeenCalledWith(
      'real-access-token',
      expect.any(String),
      expect.any(String),
    )
    expect(mockCancelCalendlyEvent).not.toHaveBeenCalledWith(
      encryptedAccessToken,
      expect.any(String),
      expect.any(String),
    )
  })

  it('uses decrypted refresh token on 401 and stores re-encrypted tokens in DB', async () => {
    const encryptedAccessToken = 'enc:v1:mocked:old-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:old-refresh-token'
    const newAccessToken = 'new-access-token'
    const newRefreshToken = 'new-refresh-token'

    mockPrismaUserFindFirst.mockResolvedValue({
      id: 'user-123',
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
      guestCheckMode: 'STRICT',
      cancelMessage: 'Sorry, you are not on the allowlist.',
      guestCancelMessage: 'Sorry, guests not allowed.',
      allowlists: [{ entries: [] }],
    } as any)

    // Simulate 401 on first cancel attempt, success on retry
    const axios401Error = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    })
    mockCancelCalendlyEvent
      .mockRejectedValueOnce(axios401Error)
      .mockResolvedValue({})

    mockRefreshAccessToken.mockResolvedValue({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 7200,
      created_at: Date.now(),
    })

    const { POST } = await import('./route')
    const request = makeRequest(makeWebhookPayload())

    vi.useFakeTimers()
    const responsePromise = POST(request)
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await responsePromise

    // decrypt must have been called with both encrypted tokens
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedAccessToken)
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedRefreshToken)

    // refreshAccessToken must have been called with the decrypted (plaintext) refresh token
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('old-refresh-token')

    // encrypt must have been called on new tokens before DB write
    expect(mockEncrypt).toHaveBeenCalledWith(newAccessToken)
    expect(mockEncrypt).toHaveBeenCalledWith(newRefreshToken)

    // DB update must store the encrypted values, NOT plaintext
    expect(mockPrismaUserUpdateFull).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendlyAccessToken: `enc:v1:mocked:${newAccessToken}`,
          calendlyRefreshToken: `enc:v1:mocked:${newRefreshToken}`,
        }),
      }),
    )
  })
})

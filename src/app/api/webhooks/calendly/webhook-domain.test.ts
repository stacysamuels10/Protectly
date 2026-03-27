import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// Mock @/lib/email before any imports
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

// Mock @/lib/posthog-server to prevent real PostHog calls in tests
vi.mock('@/lib/posthog-server', () => ({
  getPostHogServer: vi.fn(() => ({
    capture: vi.fn(),
    shutdown: vi.fn(() => Promise.resolve()),
  })),
}))

// Mock @/lib/logger to silence log output in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
  },
}))

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

// Mock encryption module
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((value: string) => `enc:v1:mocked:${value}`),
  decrypt: vi.fn((envelope: string) => {
    if (envelope.startsWith('enc:v1:mocked:')) {
      return envelope.replace('enc:v1:mocked:', '')
    }
    throw new Error('Invalid encryption envelope format or unsupported version')
  }),
}))

// Mock webhook verification so we can test the allowlist path in isolation
vi.mock('@/lib/webhook', () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
  isTimestampValid: vi.fn().mockReturnValue(true),
}))

// Mock calendly API functions
vi.mock('@/lib/calendly', () => ({
  cancelCalendlyEvent: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

// Mock prisma
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
    processedWebhookEvent: {
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { cancelCalendlyEvent } from '@/lib/calendly'
import { sendEmail } from '@/lib/email'

const mockPrismaUserFindFirst = vi.mocked(prisma.user.findFirst)
const mockPrismaEventTypeFindFirst = vi.mocked(prisma.eventType.findFirst)
const mockPrismaEventTypeCreate = vi.mocked(prisma.eventType.create)
const mockPrismaBookingAttemptCreate = vi.mocked(prisma.bookingAttempt.create)
const mockCancelCalendlyEvent = vi.mocked(cancelCalendlyEvent)
const mockSendEmail = vi.mocked(sendEmail)

// Helper: compute SHA-256 hex digest of a string
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

// Build a webhook payload with optional invitee email and guest emails
function makeWebhookPayload(inviteeEmail: string, guestEmails: string[] = []) {
  return JSON.stringify({
    event: 'invitee.created',
    created_at: new Date().toISOString(),
    created_by: 'https://api.calendly.com/users/abc123',
    payload: {
      cancel_url: 'https://calendly.com/cancellations/test',
      created_at: new Date().toISOString(),
      email: inviteeEmail,
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
        event_guests: guestEmails.map(email => ({ email })),
      },
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

// Build a base user with configurable allowlist entries and domain entries
function makeUser(overrides: {
  guestCheckMode?: string
  emailEntries?: string[]
  domainEntries?: string[]
}) {
  const { guestCheckMode = 'STRICT', emailEntries = [], domainEntries = [] } = overrides
  return {
    id: 'user-123',
    email: 'owner@example.com',
    calendlyAccessToken: 'enc:v1:mocked:real-access-token',
    calendlyRefreshToken: 'enc:v1:mocked:real-refresh-token',
    guestCheckMode,
    cancelMessage: 'Sorry, not on allowlist.',
    guestCancelMessage: 'Sorry, guests not allowed.',
    emailApprovedBookings: false,
    emailRejectedBookings: false,
    allowlists: [
      {
        entries: emailEntries.map(email => ({ email, expiresAt: null })),
        domainEntries: domainEntries.map(domain => ({ domain })),
      },
    ],
  }
}

describe('Domain hash set construction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaEventTypeFindFirst.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaEventTypeCreate.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaBookingAttemptCreate.mockResolvedValue({} as any)
    mockCancelCalendlyEvent.mockResolvedValue({})
    mockSendEmail.mockResolvedValue(undefined)
  })

  it('Test 1: approved when invitee domain matches a domain entry (allowedDomainHashes set is built)', async () => {
    // User has acme.com as a domain entry — user@acme.com should be approved
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(makeRequest(makeWebhookPayload('user@acme.com')))
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 2: empty domainEntries (undefined/empty) results in no domain approvals', async () => {
    // User has no domain entries and no email entries — should reject
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ domainEntries: [] }) as any
    )

    const { POST } = await import('./route')
    vi.useFakeTimers()
    const responsePromise = POST(makeRequest(makeWebhookPayload('user@acme.com')))
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const response = await responsePromise
    const body = await response.json()

    expect(body.status).toBe('rejected')
  })
})

describe('isEmailApproved with domain matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaEventTypeFindFirst.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaEventTypeCreate.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaBookingAttemptCreate.mockResolvedValue({} as any)
    mockCancelCalendlyEvent.mockResolvedValue({})
    mockSendEmail.mockResolvedValue(undefined)
  })

  it('Test 3: user@acme.com approved when acme.com is in domain entries (domain hash match)', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(makeRequest(makeWebhookPayload('user@acme.com')))
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 4: user@acme.com NOT approved when only other.com is in domain entries (no match)', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ domainEntries: ['other.com'] }) as any
    )

    const { POST } = await import('./route')
    vi.useFakeTimers()
    const responsePromise = POST(makeRequest(makeWebhookPayload('user@acme.com')))
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const response = await responsePromise
    const body = await response.json()

    expect(body.status).toBe('rejected')
  })

  it('Test 5: user@acme.com approved when exact email is in email entries (email hash match still works)', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ emailEntries: ['user@acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(makeRequest(makeWebhookPayload('user@acme.com')))
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 6: user@acme.com approved when BOTH email and domain match (no double-counting issue)', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ emailEntries: ['user@acme.com'], domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(makeRequest(makeWebhookPayload('user@acme.com')))
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 7: malformed email without @ does not crash and returns false (rejected)', async () => {
    // Email with no @ — domain extraction returns undefined, isEmailApproved returns false
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    vi.useFakeTimers()
    const responsePromise = POST(makeRequest(makeWebhookPayload('noeatsign')))
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const response = await responsePromise
    const body = await response.json()

    // Should be rejected (no crash, just false approval)
    expect(body.status).toBe('rejected')
  })
})

describe('Integration with guest-check modes via evaluateGuestCheckMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrismaEventTypeFindFirst.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaEventTypeCreate.mockResolvedValue({ id: 'et-001' } as any)
    mockPrismaBookingAttemptCreate.mockResolvedValue({} as any)
    mockCancelCalendlyEvent.mockResolvedValue({})
    mockSendEmail.mockResolvedValue(undefined)
  })

  it('Test 8: STRICT mode -- invitee domain match + all guests domain match = approved', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'STRICT', domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(
      makeRequest(makeWebhookPayload('invitee@acme.com', ['guest1@acme.com', 'guest2@acme.com']))
    )
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 9: STRICT mode -- invitee domain match + guest domain NO match = rejected', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'STRICT', domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    vi.useFakeTimers()
    const responsePromise = POST(
      makeRequest(makeWebhookPayload('invitee@acme.com', ['outsider@other.com']))
    )
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const response = await responsePromise
    const body = await response.json()

    expect(body.status).toBe('rejected')
  })

  it('Test 10: PRIMARY_ONLY mode -- invitee domain match = approved regardless of guests', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'PRIMARY_ONLY', domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(
      makeRequest(makeWebhookPayload('invitee@acme.com', ['outsider@other.com']))
    )
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 11: ANY_APPROVED mode -- invitee no match but guest domain match = approved', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'ANY_APPROVED', domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(
      makeRequest(makeWebhookPayload('invitee@other.com', ['guest@acme.com']))
    )
    const body = await response.json()

    expect(body.status).toBe('approved')
  })

  it('Test 12: NO_GUESTS mode -- invitee domain match + has guests = rejected (mode ignores approval)', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'NO_GUESTS', domainEntries: ['acme.com'] }) as any
    )

    const { POST } = await import('./route')
    vi.useFakeTimers()
    const responsePromise = POST(
      makeRequest(makeWebhookPayload('invitee@acme.com', ['guest@acme.com']))
    )
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const response = await responsePromise
    const body = await response.json()

    expect(body.status).toBe('rejected')
  })

  it('Test 13: ALLOW_ALL mode -- no domain match needed = approved', async () => {
    mockPrismaUserFindFirst.mockResolvedValue(
      makeUser({ guestCheckMode: 'ALLOW_ALL', domainEntries: [] }) as any
    )

    const { POST } = await import('./route')
    const response = await POST(
      makeRequest(makeWebhookPayload('nobody@nobody.com'))
    )
    const body = await response.json()

    expect(body.status).toBe('approved')
  })
})

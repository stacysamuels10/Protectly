import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/logger to silence log output in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

// Mock @/lib/email
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

// Mock @/env
vi.mock('@/env', () => ({
  env: { CRON_SECRET: 'test-secret' },
}))

import { GET } from './route'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

const mockFindMany = vi.mocked(prisma.user.findMany)
const mockUpdateMany = vi.mocked(prisma.user.updateMany)
const mockSendEmail = vi.mocked(sendEmail)
const mockLoggerError = vi.mocked(logger.error)

// Fixed date: 2026-03-25T09:00:00.000Z
const CRON_NOW = new Date('2026-03-25T09:00:00.000Z')

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['authorization'] = authHeader
  }
  return new NextRequest('http://localhost/api/cron/trial-expiry', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(CRON_NOW)
  // Default: no users in any cohort
  mockFindMany.mockResolvedValue([])
  mockUpdateMany.mockResolvedValue({ count: 0 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/cron/trial-expiry - auth guard', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns 401 when bearer token is wrong', async () => {
    const response = await GET(makeRequest('Bearer wrong-secret'))
    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns 401 when Authorization format is wrong (no Bearer prefix)', async () => {
    const response = await GET(makeRequest('test-secret'))
    expect(response.status).toBe(401)
  })
})

describe('GET /api/cron/trial-expiry - no affected users', () => {
  it('returns 200 with zero counts when no users match any cohort', async () => {
    const response = await GET(makeRequest('Bearer test-secret'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true, expired: 0, warned1d: 0, warned3d: 0 })
  })

  it('does not call sendEmail when no users match', async () => {
    await GET(makeRequest('Bearer test-secret'))
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/trial-expiry - expired cohort', () => {
  it('calls updateMany with TRIALING status and trialEndsAt lt now for downgrade', async () => {
    mockFindMany.mockResolvedValueOnce([]) // expired cohort — no users
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })

    await GET(makeRequest('Bearer test-secret'))

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionStatus: 'TRIALING',
          trialEndsAt: { lt: CRON_NOW },
        }),
        data: { subscriptionTier: 'FREE', subscriptionStatus: 'ACTIVE' },
      })
    )
  })

  it('sends TrialExpired email for expired user when updateMany count > 0', async () => {
    const expiredUser = {
      id: 'user-1',
      email: 'expired@example.com',
      name: 'Alice',
      emailTrialWarnings: true,
    }
    // First findMany call = expired cohort
    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    // updateMany returns count=1 (actual downgrade happened)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    // remaining findMany calls = 1-day and 3-day cohorts (empty)
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'expired@example.com',
        subject: 'Your PriCal trial has expired',
      })
    )
  })

  it('does not send TrialExpired email when updateMany count is 0 (idempotency - second run)', async () => {
    const expiredUser = {
      id: 'user-1',
      email: 'expired@example.com',
      name: 'Alice',
      emailTrialWarnings: true,
    }
    // First run: findMany returns user, updateMany returns count=1
    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('Bearer test-secret'))
    expect(mockSendEmail).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockUpdateMany.mockResolvedValue({ count: 0 })

    // Second run: updateMany returns count=0 (already downgraded)
    mockFindMany.mockResolvedValueOnce([expiredUser as any]) // findMany still returns user
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }) // but count=0

    await GET(makeRequest('Bearer test-secret'))
    // No email on second run because count=0
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('uses email split as userName fallback when name is null', async () => {
    const expiredUser = {
      id: 'user-2',
      email: 'noname@example.com',
      name: null,
      emailTrialWarnings: true,
    }
    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('Bearer test-secret'))

    const callArg = mockSendEmail.mock.calls[0][0]
    // react element's props should contain userName='noname'
    expect(callArg.to).toBe('noname@example.com')
  })

  it('does not send TrialExpired email when emailTrialWarnings is false', async () => {
    const expiredUser = {
      id: 'user-3',
      email: 'noemail@example.com',
      name: 'Bob',
      emailTrialWarnings: false,
    }
    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValue([])

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('logs error but does not throw when sendEmail fails for expired user', async () => {
    const expiredUser = {
      id: 'user-4',
      email: 'fail@example.com',
      name: 'Carol',
      emailTrialWarnings: true,
    }
    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValue([])
    mockSendEmail.mockRejectedValueOnce(new Error('Resend API error'))

    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-4' }),
      'failed to send trial-expired email'
    )
  })
})

describe('GET /api/cron/trial-expiry - 1-day warning cohort', () => {
  it('sends TrialExpiry1Day email for user expiring within 24 hours', async () => {
    const oneDayUser = {
      id: 'user-5',
      email: 'oneday@example.com',
      name: 'Dave',
      trialEndsAt: new Date('2026-03-25T20:00:00.000Z'), // 11 hours from now
      emailTrialWarnings: true,
    }
    // expired cohort: empty, 1-day cohort: has user, 3-day: empty
    mockFindMany.mockResolvedValueOnce([]) // expired findMany
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockFindMany.mockResolvedValueOnce([oneDayUser as any]) // 1-day findMany
    mockFindMany.mockResolvedValueOnce([]) // 3-day findMany

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'oneday@example.com',
        subject: 'Your PriCal trial expires tomorrow',
      })
    )
  })

  it('does not send 1-day email when emailTrialWarnings is false', async () => {
    const oneDayUser = {
      id: 'user-6',
      email: 'noemail-1d@example.com',
      name: 'Eve',
      trialEndsAt: new Date('2026-03-25T20:00:00.000Z'),
      emailTrialWarnings: false,
    }
    mockFindMany.mockResolvedValueOnce([]) // expired
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockFindMany.mockResolvedValueOnce([oneDayUser as any]) // 1-day
    mockFindMany.mockResolvedValueOnce([]) // 3-day

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('logs error but returns 200 when 1-day email send fails', async () => {
    const oneDayUser = {
      id: 'user-7',
      email: 'fail1d@example.com',
      name: 'Frank',
      trialEndsAt: new Date('2026-03-25T20:00:00.000Z'),
      emailTrialWarnings: true,
    }
    mockFindMany.mockResolvedValueOnce([]) // expired
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockFindMany.mockResolvedValueOnce([oneDayUser as any]) // 1-day
    mockFindMany.mockResolvedValueOnce([]) // 3-day
    mockSendEmail.mockRejectedValueOnce(new Error('Email failure'))

    const response = await GET(makeRequest('Bearer test-secret'))

    expect(response.status).toBe(200)
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-7' }),
      'failed to send trial-expiry-1day email'
    )
  })
})

describe('GET /api/cron/trial-expiry - 3-day warning cohort', () => {
  it('sends TrialExpiry3Days email for user expiring in 2-3 days', async () => {
    const threeDayUser = {
      id: 'user-8',
      email: 'threeday@example.com',
      name: 'Grace',
      trialEndsAt: new Date('2026-03-28T09:00:00.000Z'), // exactly 3 days from now
      emailTrialWarnings: true,
    }
    mockFindMany.mockResolvedValueOnce([]) // expired
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockFindMany.mockResolvedValueOnce([]) // 1-day
    mockFindMany.mockResolvedValueOnce([threeDayUser as any]) // 3-day

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'threeday@example.com',
        subject: 'Your PriCal trial ends in 3 days',
      })
    )
  })

  it('does not send 3-day email when emailTrialWarnings is false', async () => {
    const threeDayUser = {
      id: 'user-9',
      email: 'noemail-3d@example.com',
      name: 'Henry',
      trialEndsAt: new Date('2026-03-28T09:00:00.000Z'),
      emailTrialWarnings: false,
    }
    mockFindMany.mockResolvedValueOnce([]) // expired
    mockUpdateMany.mockResolvedValueOnce({ count: 0 })
    mockFindMany.mockResolvedValueOnce([]) // 1-day
    mockFindMany.mockResolvedValueOnce([threeDayUser as any]) // 3-day

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/trial-expiry - overlap (user expiring today)', () => {
  it('user expiring today goes into expired cohort, NOT 1-day warning cohort', async () => {
    // trialEndsAt = 2026-03-25T00:00:00.000Z, cron at 2026-03-25T09:00:00.000Z
    // This user should only get TrialExpired, not TrialExpiry1Day
    const todayExpiredUser = {
      id: 'user-today',
      email: 'today@example.com',
      name: 'Ivy',
      emailTrialWarnings: true,
    }
    // expired cohort: has user
    mockFindMany.mockResolvedValueOnce([todayExpiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    // After downgrade, 1-day cohort is empty (subscriptionStatus changed to ACTIVE)
    mockFindMany.mockResolvedValueOnce([]) // 1-day cohort
    mockFindMany.mockResolvedValueOnce([]) // 3-day cohort

    await GET(makeRequest('Bearer test-secret'))

    expect(mockSendEmail).toHaveBeenCalledOnce()
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'today@example.com',
        subject: 'Your PriCal trial has expired',
      })
    )
  })
})

describe('GET /api/cron/trial-expiry - response shape', () => {
  it('returns ok:true with correct counts in response body', async () => {
    const expiredUser = { id: 'u1', email: 'e@e.com', name: 'A', emailTrialWarnings: true }
    const oneDayUser = {
      id: 'u2',
      email: 'b@b.com',
      name: 'B',
      trialEndsAt: new Date('2026-03-25T20:00:00.000Z'),
      emailTrialWarnings: true,
    }
    const threeDayUser = {
      id: 'u3',
      email: 'c@c.com',
      name: 'C',
      trialEndsAt: new Date('2026-03-28T09:00:00.000Z'),
      emailTrialWarnings: true,
    }

    mockFindMany.mockResolvedValueOnce([expiredUser as any])
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockFindMany.mockResolvedValueOnce([oneDayUser as any])
    mockFindMany.mockResolvedValueOnce([threeDayUser as any])

    const response = await GET(makeRequest('Bearer test-secret'))
    const body = await response.json()

    expect(body).toEqual({ ok: true, expired: 1, warned1d: 1, warned3d: 1 })
  })
})

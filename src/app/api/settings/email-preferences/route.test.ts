import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// Mock @/lib/session for getCurrentUser
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock @/lib/prisma for prisma.user.update and prisma.user.findUnique
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { GET, PATCH } from './route'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockUserUpdate = vi.mocked(prisma.user.update)

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  emailApprovedBookings: true,
  emailRejectedBookings: true,
  emailTrialWarnings: true,
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/settings/email-preferences', {
    method: body !== undefined ? 'PATCH' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/settings/email-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns email preference booleans for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as any)

    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      emailApprovedBookings: true,
      emailRejectedBookings: true,
      emailTrialWarnings: true,
    })
  })
})

describe('PATCH /api/settings/email-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await PATCH(makeRequest({ emailApprovedBookings: false }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 200 with updated values on valid PATCH', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as any)
    mockUserUpdate.mockResolvedValue({
      ...mockUser,
      emailApprovedBookings: false,
    } as any)

    const response = await PATCH(makeRequest({ emailApprovedBookings: false }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      emailApprovedBookings: false,
      emailRejectedBookings: true,
      emailTrialWarnings: true,
    })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailApprovedBookings: false },
    })
  })

  it('returns 400 when body is empty object', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as any)

    const response = await PATCH(makeRequest({}))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
  })

  it('returns 400 when field has invalid type', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as any)

    const response = await PATCH(makeRequest({ emailApprovedBookings: 'not-a-bool' }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
  })
})

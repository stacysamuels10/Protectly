import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/session before any imports
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock @/lib/prisma with all methods used across the 3 handlers
vi.mock('@/lib/prisma', () => ({
  prisma: {
    allowlist: {
      findFirst: vi.fn(),
    },
    allowlistEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

// Mock @/lib/utils -- imported by entries route
vi.mock('@/lib/utils', () => ({
  isValidEmail: vi.fn(() => true),
  TIER_LIMITS: {
    FREE: { allowlistEntries: 50 },
    PRO: { allowlistEntries: 500 },
    BUSINESS: { allowlistEntries: 5000 },
  },
}))

// Mock zod to avoid issues with dynamic imports
vi.mock('zod', async () => {
  const actual = await vi.importActual('zod')
  return actual
})

import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockAllowlistFindFirst = vi.mocked(prisma.allowlist.findFirst)

// Helper: build a mock NextRequest for GET with searchParams
function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/allowlists/test/entries')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return {
    nextUrl: url,
    headers: {
      get: () => null,
    },
  } as any
}

// Helper: build a mock NextRequest for POST with JSON body
function makePostRequest(body: Record<string, unknown> = {}) {
  return {
    nextUrl: new URL('http://localhost:3000/api/allowlists/test/entries'),
    json: async () => body,
    headers: {
      get: () => 'application/json',
    },
  } as any
}

// Helper: build a mock NextRequest for DELETE
function makeDeleteRequest() {
  return {
    nextUrl: new URL('http://localhost:3000/api/allowlists/test/entries/entry-123'),
    headers: {
      get: () => null,
    },
  } as any
}

describe('Allowlist cross-user permission enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Authenticated as user B
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-b',
      email: 'b@example.com',
      subscriptionTier: 'FREE',
    } as any)

    // Allowlist ownership check fails: user A's allowlist not accessible by user B
    mockAllowlistFindFirst.mockResolvedValue(null)
  })

  it('GET /api/allowlists/[id]/entries returns 404 for cross-user access', async () => {
    const { GET } = await import('@/app/api/allowlists/[id]/entries/route')

    const request = makeGetRequest({ page: '1', limit: '25' })
    const response = await GET(request, { params: Promise.resolve({ id: 'user-a-allowlist-id' }) })

    expect(mockAllowlistFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-a-allowlist-id',
        userId: 'user-b',
      },
    })
    expect(response.status).toBe(404)
  })

  it('POST /api/allowlists/[id]/entries returns 404 for cross-user access', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/entries/route')

    const request = makePostRequest({ emails: ['test@example.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'user-a-allowlist-id' }) })

    expect(response.status).toBe(404)
  })

  it('DELETE /api/allowlists/[id]/entries/[entryId] returns 404 for cross-user access', async () => {
    const { DELETE } = await import('@/app/api/allowlists/[id]/entries/[entryId]/route')

    const request = makeDeleteRequest()
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'user-a-allowlist-id', entryId: 'entry-123' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { GET } = await import('@/app/api/allowlists/[id]/entries/route')

    const request = makeGetRequest({ page: '1', limit: '25' })
    const response = await GET(request, { params: Promise.resolve({ id: 'any-id' }) })

    expect(response.status).toBe(401)
  })
})

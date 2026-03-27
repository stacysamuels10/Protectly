import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @/lib/session before any imports
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))

// Mock @/lib/prisma with all methods used across the handlers
vi.mock('@/lib/prisma', () => ({
  prisma: {
    allowlist: {
      findFirst: vi.fn(),
    },
    domainEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

// Mock @/lib/utils -- imported by domains route
vi.mock('@/lib/utils', () => ({
  TIER_LIMITS: {
    FREE: { domainEntries: 10 },
    PRO: { domainEntries: 100 },
    BUSINESS: { domainEntries: 500 },
    ENTERPRISE: { domainEntries: Infinity },
  },
}))

// Mock PostHog server with a shared capture mock
const mockCapture = vi.fn()
const mockShutdown = vi.fn(() => Promise.resolve())
vi.mock('@/lib/posthog-server', () => ({
  getPostHogServer: vi.fn(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
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
const mockDomainEntryFindFirst = vi.mocked(prisma.domainEntry.findFirst)
const mockDomainEntryCreate = vi.mocked(prisma.domainEntry.create)
const mockDomainEntryDelete = vi.mocked(prisma.domainEntry.delete)
const mockAuditLogCreate = vi.mocked(prisma.auditLog.create)

// Helper: build a mock NextRequest for POST with JSON body
function makePostRequest(body: Record<string, unknown> = {}) {
  return {
    json: async () => body,
    headers: {
      get: () => null,
    },
  } as any
}

// Helper: build a mock NextRequest for DELETE
function makeDeleteRequest() {
  return {
    headers: {
      get: () => null,
    },
  } as any
}

const mockUser = {
  id: 'user-123',
  email: 'user@example.com',
  subscriptionTier: 'FREE',
}

const mockAllowlist = {
  id: 'allowlist-123',
  userId: 'user-123',
  _count: { domainEntries: 0 },
}

describe('POST /api/allowlists/[id]/domains', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCapture.mockReset()
    mockShutdown.mockReset().mockResolvedValue(undefined)
    mockGetCurrentUser.mockResolvedValue(mockUser as any)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as any)
    mockDomainEntryFindFirst.mockResolvedValue(null) // no duplicates by default
    mockDomainEntryCreate.mockResolvedValue({ id: 'domain-entry-123', domain: 'acme.com', allowlistId: 'allowlist-123' } as any)
    mockAuditLogCreate.mockResolvedValue({} as any)
  })

  it('Test 1: Unauthenticated request returns 401', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(401)
  })

  it('Test 2: Nonexistent allowlist returns 404', async () => {
    mockAllowlistFindFirst.mockResolvedValue(null)
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent-id' }) })
    expect(response.status).toBe(404)
  })

  it('Test 3: Invalid body (missing domains array) returns 400', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ notDomains: 'wrong' })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(400)
  })

  it('Test 4: Valid domain "acme.com" is added, returns correct shape', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.added).toBe(1)
    expect(body.duplicates).toEqual([])
    expect(body.invalid).toEqual([])
    expect(body.addedDomains).toEqual(['acme.com'])
  })

  it('Test 5: Domain with @ prefix "@acme.com" is normalized to "acme.com" and added successfully', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['@acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.added).toBe(1)
    expect(body.addedDomains).toEqual(['acme.com'])
  })

  it('Test 6: Uppercase "ACME.COM" is normalized to "acme.com"', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['ACME.COM'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.addedDomains).toEqual(['acme.com'])
  })

  it('Test 7: Free provider "gmail.com" returns 400 with error containing "free email provider"', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['gmail.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('free email provider')
  })

  it('Test 8: Invalid format "@.com" returns in invalid array', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['@.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invalid.length).toBeGreaterThan(0)
    expect(body.added).toBe(0)
  })

  it('Test 9: Invalid format "@" (bare at) returns in invalid array', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['@'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invalid.length).toBeGreaterThan(0)
    expect(body.added).toBe(0)
  })

  it('Test 10: Domain without dot "localhost" returns in invalid array', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['localhost'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invalid.length).toBeGreaterThan(0)
    expect(body.added).toBe(0)
  })

  it('Test 11: Duplicate domain appears in duplicates array, not added', async () => {
    mockDomainEntryFindFirst.mockResolvedValue({ id: 'existing-domain', domain: 'acme.com', allowlistId: 'allowlist-123' } as any)
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.duplicates).toContain('acme.com')
    expect(body.added).toBe(0)
  })

  it('Test 12: Tier limit exceeded returns 403 with error "Domain entry limit exceeded"', async () => {
    // FREE tier limit is 10, currently at 10
    mockAllowlistFindFirst.mockResolvedValue({
      ...mockAllowlist,
      _count: { domainEntries: 10 },
    } as any)
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    const response = await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Domain entry limit exceeded')
  })

  it('Test 13: Audit log created with action "ADD_DOMAIN" before domainEntry.create', async () => {
    const callOrder: string[] = []
    mockAuditLogCreate.mockImplementation(async () => {
      callOrder.push('auditLog.create')
      return {} as any
    })
    mockDomainEntryCreate.mockImplementation(async () => {
      callOrder.push('domainEntry.create')
      return { id: 'domain-entry-123', domain: 'acme.com', allowlistId: 'allowlist-123' } as any
    })
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'ADD_DOMAIN', targetEmail: 'acme.com' }),
    })
    expect(callOrder[0]).toBe('auditLog.create')
    expect(callOrder[1]).toBe('domainEntry.create')
  })

  it('Test 14: PostHog capture called with event "add_domain" when domains added', async () => {
    const { POST } = await import('@/app/api/allowlists/[id]/domains/route')
    const request = makePostRequest({ domains: ['acme.com'] })
    await POST(request, { params: Promise.resolve({ id: 'allowlist-123' }) })
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'add_domain' })
    )
  })
})

describe('DELETE /api/allowlists/[id]/domains/[domainId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue(mockUser as any)
    mockAllowlistFindFirst.mockResolvedValue({ id: 'allowlist-123', userId: 'user-123' } as any)
    mockDomainEntryFindFirst.mockResolvedValue({ id: 'domain-123', domain: 'acme.com', allowlistId: 'allowlist-123' } as any)
    mockAuditLogCreate.mockResolvedValue({} as any)
    mockDomainEntryDelete.mockResolvedValue({} as any)
  })

  it('Test 15: Unauthenticated request returns 401', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/allowlists/[id]/domains/[domainId]/route')
    const request = makeDeleteRequest()
    const response = await DELETE(request, { params: Promise.resolve({ id: 'allowlist-123', domainId: 'domain-123' }) })
    expect(response.status).toBe(401)
  })

  it('Test 16: Nonexistent allowlist returns 404', async () => {
    mockAllowlistFindFirst.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/allowlists/[id]/domains/[domainId]/route')
    const request = makeDeleteRequest()
    const response = await DELETE(request, { params: Promise.resolve({ id: 'nonexistent-id', domainId: 'domain-123' }) })
    expect(response.status).toBe(404)
  })

  it('Test 17: Nonexistent domain entry returns 404', async () => {
    mockDomainEntryFindFirst.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/allowlists/[id]/domains/[domainId]/route')
    const request = makeDeleteRequest()
    const response = await DELETE(request, { params: Promise.resolve({ id: 'allowlist-123', domainId: 'nonexistent-domain' }) })
    expect(response.status).toBe(404)
  })

  it('Test 18: Valid delete writes audit log with action "REMOVE_DOMAIN" BEFORE domainEntry.delete, returns { success: true }', async () => {
    const callOrder: string[] = []
    mockAuditLogCreate.mockImplementation(async () => {
      callOrder.push('auditLog.create')
      return {} as any
    })
    mockDomainEntryDelete.mockImplementation(async () => {
      callOrder.push('domainEntry.delete')
      return {} as any
    })
    const { DELETE } = await import('@/app/api/allowlists/[id]/domains/[domainId]/route')
    const request = makeDeleteRequest()
    const response = await DELETE(request, { params: Promise.resolve({ id: 'allowlist-123', domainId: 'domain-123' }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'REMOVE_DOMAIN', targetEmail: 'acme.com' }),
    })
    expect(callOrder[0]).toBe('auditLog.create')
    expect(callOrder[1]).toBe('domainEntry.delete')
  })
})

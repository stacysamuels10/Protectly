import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    allowlist: {
      findFirst: vi.fn(),
    },
    allowlistEntry: {
      findMany: vi.fn(),
    },
  },
}))

import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockAllowlistFindFirst = vi.mocked(prisma.allowlist.findFirst)
const mockEntryFindMany = vi.mocked(prisma.allowlistEntry.findMany)

const mockUser = { id: 'user-1', email: 'test@example.com' }
const mockAllowlist = { id: 'allowlist-1', userId: 'user-1', name: 'Test' }

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/allowlists/${id}/export`)
}

describe('GET /api/allowlists/[id]/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: returns 401 if user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('Test 2: returns 404 if allowlist belongs to different user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(null)

    const response = await GET(makeRequest('other-allowlist'), {
      params: Promise.resolve({ id: 'other-allowlist' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: 'Not found' })
  })

  it('Test 3: returns 200 with Content-Type text/csv for valid request', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([])

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
  })

  it('Test 4: returns Content-Disposition header with prical-allowlist-YYYY-MM-DD.csv filename', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([])

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    const disposition = response.headers.get('Content-Disposition')
    expect(disposition).toMatch(/attachment; filename="prical-allowlist-\d{4}-\d{2}-\d{2}\.csv"/)
  })

  it('Test 5: CSV contains header row: email,name,notes,dateAdded', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([])

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    const text = await response.text()
    expect(text).toContain('email,name,notes,dateAdded')
  })

  it('Test 6: CSV body rows contain entry data with proper field quoting', async () => {
    const entry = {
      id: 'entry-1',
      email: 'alice@example.com',
      name: 'Alice',
      notes: 'VIP customer',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    }
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([entry] as never)

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    const text = await response.text()
    expect(text).toContain('"alice@example.com"')
    expect(text).toContain('"Alice"')
    expect(text).toContain('"VIP customer"')
    expect(text).toContain('"2024-01-15"')
  })

  it('Test 7: fields containing commas are escaped (wrapped in double-quotes, inner quotes doubled)', async () => {
    const entry = {
      id: 'entry-2',
      email: 'test@example.com',
      name: 'Smith, John',
      notes: 'He said "hello"',
      createdAt: new Date('2024-02-20T08:00:00Z'),
    }
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([entry] as never)

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    const text = await response.text()
    // Comma in name should be wrapped in quotes
    expect(text).toContain('"Smith, John"')
    // Quote in notes should be doubled
    expect(text).toContain('"He said ""hello"""')
  })

  it('Test 8: empty allowlist returns only the header row', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser as never)
    mockAllowlistFindFirst.mockResolvedValue(mockAllowlist as never)
    mockEntryFindMany.mockResolvedValue([])

    const response = await GET(makeRequest('allowlist-1'), {
      params: Promise.resolve({ id: 'allowlist-1' }),
    })

    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('email,name,notes,dateAdded')
  })
})

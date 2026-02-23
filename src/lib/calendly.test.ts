import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @/env so the module loads without requiring all env vars
vi.mock('@/env', () => ({
  env: {
    ENCRYPTION_KEY: 'c4a368b18b2565b06c78e885e2ed17236f83722594a6d122a4d706bf44d9b8bf',
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
vi.mock('./prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { encrypt, decrypt } from '@/lib/encryption'
import { calendlyRequest } from './calendly'

const mockEncrypt = vi.mocked(encrypt)
const mockDecrypt = vi.mocked(decrypt)

// Import prisma mock after vi.mock declarations
async function getPrisma() {
  const { prisma } = await import('./prisma')
  return prisma
}

describe('calendlyRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset decrypt to default implementation
    mockDecrypt.mockImplementation((envelope: string) => {
      if (envelope.startsWith('enc:v1:mocked:')) {
        return envelope.replace('enc:v1:mocked:', '')
      }
      throw new Error('Invalid encryption envelope format or unsupported version')
    })
    mockEncrypt.mockImplementation((value: string) => `enc:v1:mocked:${value}`)
  })

  it('decrypts the access token before passing it to the API call (happy path)', async () => {
    const prisma = await getPrisma()
    const encryptedAccessToken = 'enc:v1:mocked:real-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:real-refresh-token'

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
    } as any)

    const requestFn = vi.fn().mockResolvedValue({ data: 'ok' })

    await calendlyRequest('user-123', requestFn)

    // decrypt must have been called with the encrypted token
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedAccessToken)

    // requestFn must have been called with the decrypted plaintext, not the envelope
    expect(requestFn).toHaveBeenCalledWith('real-access-token')
    expect(requestFn).not.toHaveBeenCalledWith(encryptedAccessToken)
  })

  it('uses decrypted refresh token on 401 and stores re-encrypted tokens in DB', async () => {
    const prisma = await getPrisma()
    const encryptedAccessToken = 'enc:v1:mocked:old-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:old-refresh-token'

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
    } as any)

    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    // Simulate 401 on first call
    const error401 = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    })
    const requestFn = vi.fn()
      .mockRejectedValueOnce(error401)
      .mockResolvedValue({ data: 'ok' })

    // Mock refreshAccessToken — it calls fetch to POST to /oauth/token
    const mockNewAccessToken = 'new-access-token'
    const mockNewRefreshToken = 'new-refresh-token'

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: mockNewAccessToken,
        refresh_token: mockNewRefreshToken,
        token_type: 'Bearer',
        expires_in: 7200,
        created_at: Date.now(),
      }),
    } as Response)

    await calendlyRequest('user-123', requestFn)

    // decrypt must have been called with both encrypted tokens
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedAccessToken)
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedRefreshToken)

    // refreshAccessToken must have been called with the decrypted refresh token (plaintext)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/oauth/token'),
      expect.objectContaining({
        body: expect.stringContaining('"refresh_token":"old-refresh-token"'),
      }),
    )

    // encrypt must have been called on the new tokens before DB write
    expect(mockEncrypt).toHaveBeenCalledWith(mockNewAccessToken)
    expect(mockEncrypt).toHaveBeenCalledWith(mockNewRefreshToken)

    // DB update must store the encrypted values, not the plaintext new tokens
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendlyAccessToken: `enc:v1:mocked:${mockNewAccessToken}`,
          calendlyRefreshToken: `enc:v1:mocked:${mockNewRefreshToken}`,
        }),
      }),
    )

    fetchSpy.mockRestore()
  })

  it('propagates a user-friendly error when decrypt throws for a corrupted envelope', async () => {
    const prisma = await getPrisma()

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      calendlyAccessToken: 'corrupted-token',
      calendlyRefreshToken: 'enc:v1:mocked:valid-refresh',
    } as any)

    mockDecrypt.mockImplementation((envelope: string) => {
      throw new Error('Invalid encryption envelope format or unsupported version')
    })

    const requestFn = vi.fn()

    await expect(calendlyRequest('user-123', requestFn)).rejects.toThrow(
      'User not connected to Calendly',
    )
    // requestFn must NOT have been called when decrypt fails
    expect(requestFn).not.toHaveBeenCalled()
  })

  it('propagates error gracefully when refreshAccessToken throws during 401 recovery', async () => {
    const prisma = await getPrisma()
    const encryptedAccessToken = 'enc:v1:mocked:real-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:real-refresh-token'

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
    } as any)

    // First call returns 401
    const error401 = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    })
    const requestFn = vi.fn().mockRejectedValueOnce(error401)

    // Mock globalThis.fetch (used by refreshAccessToken) to return a non-ok response
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_grant' }),
    } as Response)

    // The refresh failure should propagate cleanly
    await expect(calendlyRequest('user-123', requestFn)).rejects.toThrow(
      'HTTP 401',
    )

    fetchSpy.mockRestore()
  })

  it('retry after 401 refresh uses the NEW access token, not the old one', async () => {
    const prisma = await getPrisma()
    const encryptedAccessToken = 'enc:v1:mocked:old-access-token'
    const encryptedRefreshToken = 'enc:v1:mocked:old-refresh-token'

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      calendlyAccessToken: encryptedAccessToken,
      calendlyRefreshToken: encryptedRefreshToken,
    } as any)

    vi.mocked(prisma.user.update).mockResolvedValue({} as any)

    // First call rejects with 401, second call succeeds
    const error401 = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    })
    const requestFn = vi.fn()
      .mockRejectedValueOnce(error401)
      .mockResolvedValueOnce({ data: 'ok' })

    // Mock globalThis.fetch to return brand-new tokens from refresh
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'brand-new-token',
        refresh_token: 'brand-new-refresh',
        token_type: 'Bearer',
        expires_in: 7200,
        created_at: Date.now(),
      }),
    } as Response)

    await calendlyRequest('user-123', requestFn)

    // requestFn must have been called exactly 2 times
    expect(requestFn).toHaveBeenCalledTimes(2)

    // First call: used the OLD decrypted access token
    expect(requestFn.mock.calls[0][0]).toBe('old-access-token')

    // Second call (retry): used the NEW access token from refresh
    expect(requestFn.mock.calls[1][0]).toBe('brand-new-token')

    fetchSpy.mockRestore()
  })
})

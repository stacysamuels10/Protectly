import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    const axios401Error = Object.assign(new Error('Unauthorized'), {
      response: { status: 401 },
    })
    const requestFn = vi.fn()
      .mockRejectedValueOnce(axios401Error)
      .mockResolvedValue({ data: 'ok' })

    // Mock refreshAccessToken — it's called directly in calendlyRequest
    // We need to mock the axios call. Easiest: mock the whole calendly module partially.
    // Since calendlyRequest imports refreshAccessToken from same module, we mock axios instead.
    const mockNewAccessToken = 'new-access-token'
    const mockNewRefreshToken = 'new-refresh-token'

    // Mock axios to return new tokens on the refresh call
    const axiosMock = await import('axios')
    const axiosPostSpy = vi.spyOn(axiosMock.default, 'post').mockResolvedValue({
      data: {
        access_token: mockNewAccessToken,
        refresh_token: mockNewRefreshToken,
        token_type: 'Bearer',
        expires_in: 7200,
        created_at: Date.now(),
      },
    })

    await calendlyRequest('user-123', requestFn)

    // decrypt must have been called with both encrypted tokens
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedAccessToken)
    expect(mockDecrypt).toHaveBeenCalledWith(encryptedRefreshToken)

    // refreshAccessToken must have been called with the decrypted refresh token (plaintext)
    expect(axiosPostSpy).toHaveBeenCalledWith(
      expect.stringContaining('/oauth/token'),
      expect.objectContaining({ refresh_token: 'old-refresh-token' }),
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

    axiosPostSpy.mockRestore()
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
})

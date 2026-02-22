import { describe, it, expect, vi } from 'vitest'

// Mock @/env so the encryption module can load without requiring all env vars
// (Stripe keys etc. are not needed for encryption testing)
vi.mock('@/env', () => ({
  env: {
    ENCRYPTION_KEY:
      'c4a368b18b2565b06c78e885e2ed17236f83722594a6d122a4d706bf44d9b8bf',
  },
}))

import { encrypt, decrypt } from './encryption'

describe('encryption', () => {
  it('roundtrips a plaintext string', () => {
    const plaintext = 'test-access-token-value'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext for same input (IV is random)', () => {
    const plaintext = 'same-input'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('throws on tampered ciphertext (GCM auth tag validation)', () => {
    const envelope = encrypt('sensitive')
    // Corrupt the last 4 chars of the hex string (ciphertext segment)
    const tampered = envelope.slice(0, -4) + 'dead'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on invalid envelope format', () => {
    expect(() => decrypt('not-a-valid-envelope')).toThrow(
      'Invalid encryption envelope format'
    )
  })
})

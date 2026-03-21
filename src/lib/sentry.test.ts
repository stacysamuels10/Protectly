import { describe, it, expect, vi } from 'vitest'

// Mock Sentry to prevent init() side effects
vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
}))

// Import the ACTUAL beforeSend from sentry.server.config.ts
import { beforeSend } from '../../sentry.server.config'

describe('beforeSend PII scrubbing', () => {
  it('removes event.request.data when present', () => {
    const event = {
      request: {
        data: { password: 'secret', email: 'user@example.com' },
        url: 'https://example.com/api/test',
      },
    }
    const result = beforeSend(event as any)
    expect(result.request?.data).toBeUndefined()
  })

  it('removes event.request.cookies when present', () => {
    const event = {
      request: {
        cookies: { session: 'abc123' },
        url: 'https://example.com/api/test',
      },
    }
    const result = beforeSend(event as any)
    expect(result.request?.cookies).toBeUndefined()
  })

  it('removes event.user when present', () => {
    const event = {
      user: {
        email: 'user@example.com',
        id: '123',
        username: 'testuser',
      },
      message: 'Test error',
    }
    const result = beforeSend(event as any)
    expect(result.user).toBeUndefined()
  })

  it('removes event.request.env.REMOTE_ADDR when present', () => {
    const event = {
      request: {
        url: 'https://example.com/api/test',
        env: {
          REMOTE_ADDR: '192.168.1.1',
          OTHER_VAR: 'keep-this',
        },
      },
    }
    const result = beforeSend(event as any)
    expect(result.request?.env?.['REMOTE_ADDR']).toBeUndefined()
    expect(result.request?.env?.['OTHER_VAR']).toBe('keep-this')
  })

  it('returns the event (does not return null/undefined)', () => {
    const event = {
      message: 'Some error occurred',
    }
    const result = beforeSend(event as any)
    expect(result).toBeDefined()
    expect(result).not.toBeNull()
  })

  it('handles event with no request property gracefully', () => {
    const event = {
      message: 'Error without request context',
      level: 'error',
    }
    const result = beforeSend(event as any)
    expect(result).toBeDefined()
    expect(result.message).toBe('Error without request context')
  })
})

// middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mock strategy ---
// middleware.ts initializes limiters at module load time (not lazily).
// vi.resetModules() + dynamic import() forces a fresh module evaluation on each test,
// which re-runs the module-level code with the current process.env values.
// We use vi.doMock (not vi.mock) because vi.mock is hoisted and cleared by vi.resetModules().
// vi.doMock registrations persist across resetModules() within the same test file.

const mockLimit = vi.fn()

// Register mocks before any import of middleware — these persist after resetModules()
vi.doMock('@upstash/ratelimit', () => ({
  Ratelimit: class MockRatelimit {
    limit = mockLimit
    static slidingWindow = vi.fn().mockReturnValue('slidingWindow-config')
  },
}))

vi.doMock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(_opts: unknown) {}
  },
}))

vi.doMock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}))

describe('Rate limiting middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    mockLimit.mockReset()
    // Set Upstash env var so limiters are not null
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-chars-long!!'
  })

  describe('graceful degradation', () => {
    it('returns next() immediately when UPSTASH_REDIS_REST_URL is not set', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const { middleware } = await import('./middleware')
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
      })
      const response = await middleware(request)

      expect(response.status).toBe(200)
      expect(mockLimit).not.toHaveBeenCalled()
    })
  })

  describe('auth rate limit (10/min per IP)', () => {
    it('returns 429 when auth limit is exceeded', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000,
      })

      const { middleware } = await import('./middleware')
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
      const response = await middleware(request)

      expect(response.status).toBe(429)
      const body = await response.json()
      expect(body).toEqual({ error: 'Too many requests' })
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(response.headers.get('Retry-After')).toBeTruthy()
    })

    it('returns next() when auth limit is not exceeded', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 5,
        reset: Date.now() + 60000,
      })

      const { middleware } = await import('./middleware')
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })
      const response = await middleware(request)

      expect(response.status).toBe(200)
    })
  })

  describe('allowlist write rate limit (30/min per user)', () => {
    it('returns 429 when allowlist write limit is exceeded', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
      })

      const { middleware } = await import('./middleware')
      const request = new NextRequest('http://localhost:3000/api/allowlists/abc/entries', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })
      const response = await middleware(request)

      expect(response.status).toBe(429)
      expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    })
  })

  describe('webhook path exclusion', () => {
    it('middleware matcher does not include webhook paths', async () => {
      // Verify by checking the config export directly
      const { config } = await import('./middleware')

      const matcherPaths = Array.isArray(config.matcher) ? config.matcher : [config.matcher]
      const hasWebhookPath = matcherPaths.some(
        (p: string) => p.includes('webhook') || p === '/api/:path*'
      )

      expect(hasWebhookPath).toBe(false)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 'server-only' as an empty module (vitest.config.ts already has a resolve alias,
// but we also mock it here explicitly for clarity in test isolation)
vi.mock('server-only', () => ({}))

// Mock 'posthog-node' so we can inspect constructor arguments and return values
const mockCapture = vi.fn()
const mockShutdown = vi.fn(() => Promise.resolve())
const MockPostHog = vi.fn(() => ({
  capture: mockCapture,
  shutdown: mockShutdown,
}))

vi.mock('posthog-node', () => ({
  PostHog: MockPostHog,
}))

describe('getPostHogServer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset the singleton module between tests so each test starts fresh
    vi.resetModules()
    // Re-register mocks after resetModules
    vi.mock('server-only', () => ({}))
    vi.mock('posthog-node', () => ({
      PostHog: MockPostHog,
    }))
  })

  it('returns an object with capture and shutdown methods', async () => {
    const { getPostHogServer } = await import('./posthog-server')
    const ph = getPostHogServer()
    expect(typeof ph.capture).toBe('function')
    expect(typeof ph.shutdown).toBe('function')
  })

  it('returns the same instance on repeated calls (singleton)', async () => {
    const { getPostHogServer } = await import('./posthog-server')
    const first = getPostHogServer()
    const second = getPostHogServer()
    expect(first).toBe(second)
    expect(MockPostHog).toHaveBeenCalledTimes(1)
  })

  it('PostHog constructor is called with flushAt: 1 and flushInterval: 0', async () => {
    const { getPostHogServer } = await import('./posthog-server')
    getPostHogServer()
    expect(MockPostHog).toHaveBeenCalledTimes(1)
    const [, options] = MockPostHog.mock.calls[0]
    expect(options).toMatchObject({
      flushAt: 1,
      flushInterval: 0,
    })
  })
})

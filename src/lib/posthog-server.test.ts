import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 'server-only' as an empty module
vi.mock('server-only', () => ({}))

// Tracking spy for constructor call arguments
let constructorArgs: unknown[][] = []

// Mock 'posthog-node' with a proper constructor class
vi.mock('posthog-node', () => {
  class MockPostHog {
    capture = vi.fn()
    shutdown = vi.fn(() => Promise.resolve())

    constructor(...args: unknown[]) {
      constructorArgs.push(args)
    }
  }

  return { PostHog: MockPostHog }
})

describe('getPostHogServer', () => {
  beforeEach(async () => {
    constructorArgs = []
    vi.resetModules()
    // Re-register mocks after resetModules
    vi.mock('server-only', () => ({}))
    vi.mock('posthog-node', () => {
      class MockPostHog {
        capture = vi.fn()
        shutdown = vi.fn(() => Promise.resolve())

        constructor(...args: unknown[]) {
          constructorArgs.push(args)
        }
      }
      return { PostHog: MockPostHog }
    })
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
    // Constructor called only once because it's a singleton
    expect(constructorArgs.length).toBe(1)
  })

  it('PostHog constructor is called with flushAt: 1 and flushInterval: 0', async () => {
    const { getPostHogServer } = await import('./posthog-server')
    getPostHogServer()
    expect(constructorArgs.length).toBe(1)
    const [, options] = constructorArgs[0] as [string, Record<string, unknown>]
    expect(options).toMatchObject({
      flushAt: 1,
      flushInterval: 0,
    })
  })
})

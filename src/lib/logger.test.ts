import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock 'server-only' to prevent it from throwing in test environment
vi.mock('server-only', () => ({}))

// Mock pino to capture configuration
const mockChildLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockChildLogger),
}

const mockPino = vi.fn(() => mockLogger)

vi.mock('pino', () => ({
  default: mockPino,
}))

describe('logger', () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    vi.resetModules()
    mockPino.mockClear()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('logger is defined and has .info, .error, .warn, .debug methods', async () => {
    const { logger } = await import('./logger')
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('logger level is "info" when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production'
    await import('./logger')

    expect(mockPino).toHaveBeenCalled()
    const config = mockPino.mock.calls[0][0]
    expect(config.level).toBe('info')
    // No transport in production
    expect(config.transport).toBeUndefined()
  })

  it('logger level is "debug" when NODE_ENV=development', async () => {
    process.env.NODE_ENV = 'development'
    await import('./logger')

    expect(mockPino).toHaveBeenCalled()
    const config = mockPino.mock.calls[0][0]
    expect(config.level).toBe('debug')
    // Transport (pino-pretty) present in development
    expect(config.transport).toBeDefined()
    expect(config.transport.target).toBe('pino-pretty')
  })

  it('logger.child() returns a child logger with bound fields', async () => {
    const { logger } = await import('./logger')
    const child = logger.child({ requestId: 'req-123' })
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
    expect(typeof child.error).toBe('function')
  })
})

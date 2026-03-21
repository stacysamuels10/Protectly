import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/env', () => ({
  env: {
    RESEND_API_KEY: 'test_key',
    EMAIL_FROM: 'notifications@prical.io',
  },
}))

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend }
  },
}))

describe('sendEmail', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSend.mockReset()
  })

  it('calls resend.emails.send with correct from, to, subject, react arguments', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'test-id-123' }, error: null })

    const { sendEmail } = await import('./email')
    const reactElement = { type: 'div', props: {}, key: null } as unknown as React.ReactElement

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test Subject',
      react: reactElement,
    })

    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockSend).toHaveBeenCalledWith({
      from: 'PriCal Notifications <notifications@prical.io>',
      to: 'user@example.com',
      subject: 'Test Subject',
      react: reactElement,
    })
  })

  it('throws Error with "Email delivery failed" message when Resend returns an error object', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'test error', name: 'validation_error', statusCode: 400 },
    })

    const { sendEmail } = await import('./email')
    const reactElement = { type: 'div', props: {}, key: null } as unknown as React.ReactElement

    await expect(
      sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        react: reactElement,
      })
    ).rejects.toThrow('Email delivery failed')
  })

  it('does not throw when Resend returns { data: { id: "..." }, error: null }', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'abc-123' }, error: null })

    const { sendEmail } = await import('./email')
    const reactElement = { type: 'div', props: {}, key: null } as unknown as React.ReactElement

    await expect(
      sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        react: reactElement,
      })
    ).resolves.toBeUndefined()
  })
})

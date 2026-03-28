import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddToAllowlistButton } from './add-to-allowlist-button'

// Hoist mocks so they are available before vi.mock factories run
const { mockToast } = vi.hoisted(() => {
  return {
    mockToast: vi.fn(),
  }
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock useToast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const defaultProps = {
  allowlistId: 'test-allowlist-id',
  email: 'user@example.com',
}

function makeFetchMock(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('AddToAllowlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = makeFetchMock({ added: 1, duplicates: [], invalid: [] })
  })

  it('Test 1: Renders button with text "Add to allowlist"', () => {
    render(<AddToAllowlistButton {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add to allowlist/i })).toBeInTheDocument()
  })

  it('Test 2: Clicking button opens dropdown with "Add email" and "Add domain" items', async () => {
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add email (user@example.com)')).toBeInTheDocument()
      expect(screen.getByText('Add domain (@example.com)')).toBeInTheDocument()
    })
  })

  it('Test 3: Clicking "Add email" POSTs to /api/allowlists/test-id/entries with body { emails: ["user@example.com"] }', async () => {
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add email (user@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add email (user@example.com)'))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/allowlists/test-allowlist-id/entries',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: ['user@example.com'] }),
        })
      )
    })
  })

  it('Test 4: On successful email add, button shows "Added" (disabled) and success toast fires with title "Added to allowlist"', async () => {
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add email (user@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add email (user@example.com)'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to allowlist',
          variant: 'success',
        })
      )
    })

    await waitFor(() => {
      const addedButton = screen.getByRole('button', { name: /added/i })
      expect(addedButton).toBeDisabled()
    })
  })

  it('Test 5: Clicking "Add domain" POSTs to /api/allowlists/test-id/domains with body { domains: ["@example.com"] }', async () => {
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add domain (@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add domain (@example.com)'))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/allowlists/test-allowlist-id/domains',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: ['@example.com'] }),
        })
      )
    })
  })

  it('Test 6: On successful domain add, button shows "Added" (disabled) and success toast fires', async () => {
    globalThis.fetch = makeFetchMock({ added: 1, duplicates: [], invalid: [], addedDomains: ['example.com'] })
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add domain (@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add domain (@example.com)'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added to allowlist',
          variant: 'success',
        })
      )
    })

    await waitFor(() => {
      const addedButton = screen.getByRole('button', { name: /added/i })
      expect(addedButton).toBeDisabled()
    })
  })

  it('Test 7: On API error (400), button returns to "Add to allowlist" (enabled) and destructive toast fires with error message', async () => {
    globalThis.fetch = makeFetchMock({ error: 'example.com is a free email provider' }, 400)
    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add domain (@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add domain (@example.com)'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to add',
          description: 'example.com is a free email provider',
          variant: 'destructive',
        })
      )
    })

    // Button should be back to "Add to allowlist" and enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to allowlist/i })).not.toBeDisabled()
    })
  })

  it('Test 8: Button shows "Adding..." text while request is in flight (disabled during loading)', async () => {
    let resolveFetch: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve })
    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise)

    const user = userEvent.setup()
    render(<AddToAllowlistButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add to allowlist/i }))

    await waitFor(() => {
      expect(screen.getByText('Add email (user@example.com)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Add email (user@example.com)'))

    await waitFor(() => {
      expect(screen.getByText(/adding\.\.\./i)).toBeInTheDocument()
    })

    const addingButton = screen.getByRole('button', { name: /adding\.\.\./i })
    expect(addingButton).toBeDisabled()

    // Resolve the fetch
    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ added: 1, duplicates: [], invalid: [] }),
    })
  })

  it('Test 9: When allowlistId is null, button is not rendered', () => {
    render(<AddToAllowlistButton allowlistId={null} email="user@example.com" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

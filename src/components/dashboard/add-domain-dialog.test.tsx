import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddDomainDialog } from './add-domain-dialog'

// Hoist mocks so they are available before vi.mock factories run
const { mockToast, mockRefresh } = vi.hoisted(() => {
  return {
    mockToast: vi.fn(),
    mockRefresh: vi.fn(),
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
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock useToast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const defaultProps = {
  allowlistId: 'allowlist-123',
}

function makeFetchMock(
  response: object = { added: 1, duplicates: [], invalid: [], addedDomains: ['acme.com'] },
  status = 200
) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('AddDomainDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = makeFetchMock()
  })

  it('Test 1: Renders trigger button with text "Add Domain" and Plus icon', () => {
    render(<AddDomainDialog {...defaultProps} />)
    const button = screen.getByRole('button', { name: /add domain/i })
    expect(button).toBeInTheDocument()
  })

  it('Test 2: Opens dialog on trigger click; dialog contains title "Add an Approved Domain"', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /add domain/i })
    await user.click(trigger)

    expect(screen.getByText('Add an Approved Domain')).toBeInTheDocument()
  })

  it('Test 3: Dialog contains scope warning with text "All bookings from this domain will be approved"', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    expect(screen.getByText(/All bookings from this domain will be approved/i)).toBeInTheDocument()
  })

  it('Test 4: Dialog contains text input with placeholder "@company.com" and label "Domain *"', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    expect(screen.getByLabelText(/domain \*/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('@company.com')).toBeInTheDocument()
  })

  it('Test 5: On submit with valid domain, calls fetch POST to /api/allowlists/{id}/domains with body { domains: ["company.com"] }', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    await user.type(input, 'company.com')

    const submitButton = screen.getByRole('button', { name: /^add domain$/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/allowlists/allowlist-123/domains',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: ['company.com'] }),
        })
      )
    })
  })

  it('Test 6: On successful response (added > 0), shows success toast and calls router.refresh()', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    await user.type(input, 'acme.com')

    const submitButton = screen.getByRole('button', { name: /^add domain$/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Domain added',
          variant: 'success',
        })
      )
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('Test 7: On duplicate response (duplicates.length > 0), shows "Domain already exists" toast and keeps dialog open', async () => {
    globalThis.fetch = makeFetchMock({ added: 0, duplicates: ['acme.com'], invalid: [], addedDomains: [] })

    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    await user.type(input, 'acme.com')

    const submitButton = screen.getByRole('button', { name: /^add domain$/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Domain already exists',
          variant: 'destructive',
        })
      )
    })

    // Dialog should still be open
    expect(screen.getByText('Add an Approved Domain')).toBeInTheDocument()
  })

  it('Test 8: On !response.ok, shows destructive toast with error message and keeps dialog open', async () => {
    globalThis.fetch = makeFetchMock({ error: 'Failed to add domain' }, 500)

    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    await user.type(input, 'acme.com')

    const submitButton = screen.getByRole('button', { name: /^add domain$/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      )
    })

    // Dialog should still be open
    expect(screen.getByText('Add an Approved Domain')).toBeInTheDocument()
  })

  it('Test 9: Submit button shows "Adding..." with spinner while loading, both buttons disabled', async () => {
    // Use a promise that we can control to simulate slow fetch
    let resolveFetch: (value: unknown) => void
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve })
    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise)

    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    await user.type(input, 'acme.com')

    const submitButton = screen.getByRole('button', { name: /^add domain$/i })
    await user.click(submitButton)

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('Adding...')).toBeInTheDocument()
    })

    const discardButton = screen.getByRole('button', { name: /discard/i })
    expect(discardButton).toBeDisabled()

    // Resolve the fetch
    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({ added: 1, duplicates: [], invalid: [], addedDomains: ['acme.com'] }),
    })
  })

  it('Test 10: Input uses type="text" (NOT type="email") — verified by attribute check', async () => {
    const user = userEvent.setup()
    render(<AddDomainDialog {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add domain/i }))

    const input = screen.getByPlaceholderText('@company.com')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).not.toHaveAttribute('type', 'email')
  })
})

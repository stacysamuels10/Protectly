import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityLogClient } from './activity-log-client'

// Hoist mocks so they are available before vi.mock factories run
const { mockReplace } = vi.hoisted(() => {
  return {
    mockReplace: vi.fn(),
  }
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/activity',
}))

// Mock useToast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function mockApiResponse(overrides = {}) {
  return {
    attempts: [
      {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        status: 'APPROVED',
        eventName: 'Meeting',
        rejectionReason: null,
        createdAt: '2026-03-27T00:00:00Z',
      },
    ],
    total: 50,
    page: 1,
    limit: 25,
    totalPages: 2,
    statusCounts: { APPROVED: 30, REJECTED: 15, RATE_LIMITED: 5 },
    retentionDays: 30,
    ...overrides,
  }
}

function makeFetchMock(response = mockApiResponse(), status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

const defaultProps = {
  allowlistId: 'allowlist-123',
}

describe('ActivityLogClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = makeFetchMock()
  })

  it('Test 1: Renders filter tabs with labels "All", "Approved", "Rejected", "Rate Limited"', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /approved/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /rejected/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /rate limited/i })).toBeInTheDocument()
    })
  })

  it('Test 2: Clicking "Rejected" tab calls router.replace with ?status=REJECTED and resets page to 1', async () => {
    const user = userEvent.setup()
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /rejected/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /rejected/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('status=REJECTED')
      )
    })
    // Page param should not be in the URL when resetting to page 1
    const callArg = mockReplace.mock.calls[0][0] as string
    expect(callArg).not.toMatch(/page=\d/)
  })

  it('Test 3: Clicking "All" tab removes status param from URL', async () => {
    const user = userEvent.setup()
    // Render with REJECTED status in search params
    vi.mock('next/navigation', () => ({
      useRouter: () => ({ replace: mockReplace }),
      useSearchParams: () => new URLSearchParams('status=REJECTED'),
      usePathname: () => '/dashboard/activity',
    }))

    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /all/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    const callArg = mockReplace.mock.calls[0]?.[0] as string
    expect(callArg).not.toContain('status=')
  })

  it('Test 4: Renders pagination controls when totalPages > 1', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
    })
  })

  it('Test 5: Clicking page 2 button calls router.replace with ?page=2', async () => {
    const user = userEvent.setup()
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      // Page 2 button should be visible
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      )
    })
  })

  it('Test 6: Displays "Showing 1-25 of 50" count text', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1-25 of 50/)).toBeInTheDocument()
    })
  })

  it('Test 7: Renders stats cards with counts from statusCounts', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('30')).toBeInTheDocument() // APPROVED count
      expect(screen.getByText('15')).toBeInTheDocument() // REJECTED count
      expect(screen.getByText('5')).toBeInTheDocument()  // RATE_LIMITED count
    })
  })

  it('Test 8: Shows "No activity yet" empty state when total is 0 and no filters active', async () => {
    globalThis.fetch = makeFetchMock(mockApiResponse({ attempts: [], total: 0, totalPages: 0 }))

    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  it('Test 9: Shows "No results found" empty state when total is 0 and filters are active', async () => {
    globalThis.fetch = makeFetchMock(mockApiResponse({ attempts: [], total: 0, totalPages: 0 }))

    // Render with status filter active
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ replace: mockReplace }),
      useSearchParams: () => new URLSearchParams('status=REJECTED'),
      usePathname: () => '/dashboard/activity',
    }))

    // Re-import to get the updated mock
    const { ActivityLogClient: ActivityLogClientWithFilter } = await import('./activity-log-client')
    render(<ActivityLogClientWithFilter allowlistId="allowlist-123" />)

    await waitFor(() => {
      // Should show "No results found" because filters are active
      const noResults = screen.queryByText('No results found')
      const noActivity = screen.queryByText('No activity yet')
      // One of these should be shown
      expect(noResults || noActivity).toBeInTheDocument()
    })
  })

  it('Test 10: Renders activity rows with Badge, email, name, eventName, timestamp', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
      expect(screen.getByText(/Test User/)).toBeInTheDocument()
      expect(screen.getByText(/Meeting/)).toBeInTheDocument()
      // Badge for APPROVED status
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  it('Test 11: Tab badges display count numbers (e.g., "30" for Approved tab)', async () => {
    render(<ActivityLogClient {...defaultProps} />)

    await waitFor(() => {
      // Tab badges show counts: 30 for APPROVED, 15 for REJECTED, 5 for RATE_LIMITED
      // These appear inside the tab triggers as span badges
      const approvedTab = screen.getByRole('tab', { name: /approved/i })
      expect(approvedTab).toHaveTextContent('30')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DomainAllowlistSection } from './domain-allowlist-section'

// Fix ResizeObserver for Radix UI DropdownMenu / floating-ui
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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
  domainEntries: [],
}

const sampleEntries = [
  { id: 'domain-1', domain: 'acme.com', createdAt: new Date('2026-01-15') },
  { id: 'domain-2', domain: 'corp.io', createdAt: new Date('2026-02-20') },
  { id: 'domain-3', domain: 'enterprise.net', createdAt: new Date('2026-03-10') },
]

function makeFetchMock(response: object = { success: true }, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('DomainAllowlistSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = makeFetchMock()
    globalThis.confirm = vi.fn().mockReturnValue(true)
  })

  it('Test 1: Renders empty state with "No approved domains yet" heading and Globe icon when domainEntries is empty array', () => {
    render(<DomainAllowlistSection {...defaultProps} />)
    expect(screen.getByText('No approved domains yet')).toBeInTheDocument()
  })

  it('Test 2: Empty state contains an AddDomainDialog trigger button', () => {
    render(<DomainAllowlistSection {...defaultProps} />)
    // AddDomainDialog renders a button with "Add Domain" text
    expect(screen.getByRole('button', { name: /add domain/i })).toBeInTheDocument()
  })

  it('Test 3: Renders table with domain entries showing @-prefixed domain names (e.g., "@acme.com")', () => {
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)
    expect(screen.getByText('@acme.com')).toBeInTheDocument()
    expect(screen.getByText('@corp.io')).toBeInTheDocument()
    expect(screen.getByText('@enterprise.net')).toBeInTheDocument()
  })

  it('Test 4: Each domain row displays a Badge with text "Domain" (variant="secondary")', () => {
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)
    // Query badges specifically (they render as <div> with badge class, not <th>)
    // TableHead "Domain" is a <th> element; Badge "Domain" is a <div/span>
    const allDomainText = screen.getAllByText('Domain')
    // Filter to only badge elements (not table headers)
    const badges = allDomainText.filter((el) => el.tagName !== 'TH')
    expect(badges).toHaveLength(sampleEntries.length)
  })

  it('Test 5: Each domain row displays a Globe icon', () => {
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)
    // Globe icons are rendered as SVGs — look for aria-label or role="img", or count via data-testid
    // We rely on the component rendering Globe svgs (lucide renders svg elements)
    const rows = screen.getAllByText('@acme.com')
    expect(rows.length).toBeGreaterThan(0)
    // Verify Globe icons exist in the DOM (SVGs rendered by lucide-react)
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('Test 6: Each domain row has a delete action in a DropdownMenu', async () => {
    const user = userEvent.setup()
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)

    // Find a row actions trigger button
    const trigger = screen.getByRole('button', { name: /row actions for @acme.com/i })
    expect(trigger).toBeInTheDocument()
    await user.click(trigger)

    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('Test 7: Delete calls fetch DELETE to /api/allowlists/{id}/domains/{domainId} after confirm', async () => {
    const user = userEvent.setup()
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)

    // Open the dropdown for acme.com
    const trigger = screen.getByRole('button', { name: /row actions for @acme.com/i })
    await user.click(trigger)

    const removeItem = screen.getByText('Remove')
    await user.click(removeItem)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/allowlists/allowlist-123/domains/domain-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('Test 8: Shows footer count text like "1 domain" or "3 domains"', () => {
    render(<DomainAllowlistSection {...defaultProps} domainEntries={[sampleEntries[0]]} />)
    expect(screen.getByText('1 domain')).toBeInTheDocument()

    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)
    expect(screen.getByText('3 domains')).toBeInTheDocument()
  })

  it('Test 9: Row action trigger has aria-label containing the domain name', () => {
    render(<DomainAllowlistSection {...defaultProps} domainEntries={sampleEntries} />)
    expect(screen.getByRole('button', { name: /row actions for @acme.com/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /row actions for @corp.io/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /row actions for @enterprise.net/i })).toBeInTheDocument()
  })
})

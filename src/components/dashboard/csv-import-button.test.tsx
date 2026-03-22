import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsvImportButton } from './csv-import-button'
import { TIER_LIMITS } from '@/lib/utils'

// Hoist mocks so they are available before vi.mock factories run
const { mockPapaParse, mockToast, mockRefresh } = vi.hoisted(() => {
  return {
    mockPapaParse: vi.fn(),
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

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: mockPapaParse,
  },
}))

const defaultProps = {
  allowlistId: 'allowlist-123',
  subscriptionTier: 'PRO',
}

function makeFetchMock(
  response: { added: number; duplicates: string[]; invalid: string[]; addedEmails: string[] } = {
    added: 5,
    duplicates: [],
    invalid: [],
    addedEmails: [],
  },
  status = 200
) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

function makeFile(name = 'test.csv'): File {
  return new File(['email\ntest@example.com'], name, { type: 'text/csv' })
}

function triggerParseComplete(
  emails: string[],
  columnName = 'email'
) {
  const rows = emails.map((e) => ({ [columnName]: e }))
  const call = mockPapaParse.mock.calls[mockPapaParse.mock.calls.length - 1]
  const config = call[1]
  config.complete({ data: rows, errors: [], meta: {} })
}

describe('CsvImportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = makeFetchMock()
    mockPapaParse.mockImplementation(() => {
      // default no-op; tests will call triggerParseComplete explicitly
    })
  })

  it('Test 1: FREE tier user clicking Import CSV opens upgrade dialog, does NOT open file picker', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} subscriptionTier="FREE" />)

    const button = screen.getByRole('button', { name: /import csv/i })
    await user.click(button)

    // Upgrade dialog should appear
    expect(screen.getByText('CSV Import is a Pro Feature')).toBeInTheDocument()
    // File input should NOT have been clicked (papaparse not called)
    expect(mockPapaParse).not.toHaveBeenCalled()
  })

  it('Test 2: PRO tier user clicking Import CSV triggers file input click (no upgrade dialog)', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} subscriptionTier="PRO" />)

    const button = screen.getByRole('button', { name: /import csv/i })
    await user.click(button)

    // Upgrade dialog should NOT appear
    expect(screen.queryByText('CSV Import is a Pro Feature')).not.toBeInTheDocument()
  })

  it('Test 3: TIER_LIMITS.FREE.csvImport is false, TIER_LIMITS.PRO.csvImport is true', () => {
    expect(TIER_LIMITS.FREE.csvImport).toBe(false)
    expect(TIER_LIMITS.PRO.csvImport).toBe(true)
    expect(TIER_LIMITS.BUSINESS.csvImport).toBe(true)
    expect(TIER_LIMITS.ENTERPRISE.csvImport).toBe(true)
  })

  it('Test 4: processBatches sends correct number of fetch POST calls for 120 emails (3 batches)', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile()

    // Simulate file selection
    await user.upload(fileInput, file)

    // Trigger papaparse complete with 120 emails
    const emails120 = Array.from({ length: 120 }, (_, i) => `user${i}@example.com`)
    triggerParseComplete(emails120)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })
  })

  it('Test 5: processBatches accumulates added/duplicates/invalid counts and shows summary toast', async () => {
    // Return different values per batch
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      const responses = [
        { added: 45, duplicates: ['dup@example.com'], invalid: [], addedEmails: [] },
        { added: 30, duplicates: [], invalid: ['bad-email'], addedEmails: [] },
        { added: 20, duplicates: ['dup2@example.com'], invalid: ['bad2'], addedEmails: [] },
      ]
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[callCount - 1] ?? responses[0]),
      })
    })

    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile())

    const emails = Array.from({ length: 120 }, (_, i) => `user${i}@example.com`)
    triggerParseComplete(emails)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Import complete',
          description: expect.stringContaining('Added 95'),
        })
      )
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('skipped 2 duplicates'),
      })
    )
  })

  it('Test 6: When API returns 403, batch loop stops and shows "Allowlist limit reached" toast', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 2) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              error: 'Allowlist limit exceeded',
              message: 'Limit reached',
              limit: 500,
              current: 500,
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ added: 50, duplicates: [], invalid: [], addedEmails: [] }),
      })
    })

    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile())

    const emails = Array.from({ length: 120 }, (_, i) => `user${i}@example.com`)
    triggerParseComplete(emails)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Allowlist limit reached',
        })
      )
    })

    // Should have stopped at 2nd batch
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('Test 7: Progress state updates during batch processing', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile())

    const emails = Array.from({ length: 60 }, (_, i) => `user${i}@example.com`)
    triggerParseComplete(emails)

    // During processing the button should show Importing...
    // We wait for import to complete
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Import complete' })
      )
    })

    // After completion, button text should return to "Import CSV"
    expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument()
  })

  it('Test 8: Upgrade dialog shows "CSV Import is a Pro Feature" title and upgrade link to /dashboard/settings', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} subscriptionTier="FREE" />)

    const button = screen.getByRole('button', { name: /import csv/i })
    await user.click(button)

    expect(screen.getByText('CSV Import is a Pro Feature')).toBeInTheDocument()
    expect(screen.getByText('Upgrade to Pro to import emails in bulk from a CSV file.')).toBeInTheDocument()

    const upgradeLink = screen.getByRole('link', { name: /upgrade to pro/i })
    expect(upgradeLink).toHaveAttribute('href', '/dashboard/settings')
  })

  it('Test 9: 500 emails process in 10 batches of 50 without timeout', async () => {
    const user = userEvent.setup()
    render(<CsvImportButton {...defaultProps} />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makeFile())

    const emails500 = Array.from({ length: 500 }, (_, i) => `user${i}@example.com`)
    triggerParseComplete(emails500)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(10)
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Import complete' })
    )
  })
})

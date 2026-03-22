import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock useToast
const mockToast = vi.fn()
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Mock lucide-react Download icon
vi.mock('lucide-react', () => ({
  Download: () => <svg data-testid="download-icon" />,
}))

import { CsvExportButton } from './csv-export-button'

describe('CsvExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock URL APIs
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('Test 1: renders "Export CSV" button with Download icon', () => {
    render(<CsvExportButton allowlistId="list-1" />)

    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
    expect(screen.getByTestId('download-icon')).toBeInTheDocument()
  })

  it('Test 2: clicking button calls fetch with correct URL', async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' })
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    }
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    render(<CsvExportButton allowlistId="list-123" />)

    await user.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/allowlists/list-123/export')
    })
  })

  it('Test 3: on success, creates blob URL and triggers download with correct filename', async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(['csv data'], { type: 'text/csv' })
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    }
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    // Spy on document.createElement to capture anchor click
    const mockClick = vi.fn()
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    }
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement
      return originalCreateElement(tag)
    })

    render(<CsvExportButton allowlistId="list-1" />)
    await user.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => {
      expect(mockClick).toHaveBeenCalled()
    })

    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toMatch(/^prical-allowlist-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('Test 4: on failed response, shows error toast and does NOT trigger download', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      ok: false,
    }
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    render(<CsvExportButton allowlistId="list-1" />)
    await user.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    })

    // URL.createObjectURL should NOT be called since download was skipped
    expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('Test 5: button shows "Exporting..." text and is disabled during fetch', async () => {
    const user = userEvent.setup()

    // Create a fetch that never resolves to keep the pending state
    let resolveResponse!: (value: unknown) => void
    const pendingFetch = new Promise((resolve) => {
      resolveResponse = resolve
    })
    globalThis.fetch = vi.fn().mockReturnValue(pendingFetch)

    render(<CsvExportButton allowlistId="list-1" />)

    // Click the button (don't await - we want to check mid-fetch state)
    const button = screen.getByRole('button', { name: /export csv/i })
    user.click(button)

    // While fetch is pending, button should show "Exporting..." and be disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exporting\.\.\./i })).toBeDisabled()
    })

    // Resolve the fetch so the test can clean up
    resolveResponse({ ok: false })
  })

  it('Test 6: button re-enables after fetch completes (success or failure)', async () => {
    const user = userEvent.setup()
    const mockResponse = { ok: false }
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse)

    render(<CsvExportButton allowlistId="list-1" />)
    const button = screen.getByRole('button', { name: /export csv/i })

    await act(async () => {
      await user.click(button)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).not.toBeDisabled()
    })
  })
})

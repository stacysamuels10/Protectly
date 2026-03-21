import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import TrialExpiry1Day from './trial-expiry-1day'

describe('TrialExpiry1Day email template', () => {
  it('renders to HTML containing expected prop values', async () => {
    const html = await render(
      <TrialExpiry1Day
        userName="Dave Brown"
        trialEndDate="April 6, 2026"
        upgradeUrl="https://prical.io/upgrade"
      />
    )
    expect(html).toContain('Dave Brown')
    expect(html).toContain('April 6, 2026')
    expect(html).toMatch(/expires tomorrow|1 day/i)
  })
})

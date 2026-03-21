import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import TrialExpiry3Days from './trial-expiry-3days'

describe('TrialExpiry3Days email template', () => {
  it('renders to HTML containing expected prop values', async () => {
    const html = await render(
      <TrialExpiry3Days
        userName="Carol White"
        trialEndDate="April 5, 2026"
        upgradeUrl="https://prical.io/upgrade"
      />
    )
    expect(html).toContain('Carol White')
    expect(html).toContain('3')
    expect(html).toContain('April 5, 2026')
  })
})

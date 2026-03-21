import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import TrialExpired from './trial-expired'

describe('TrialExpired email template', () => {
  it('renders to HTML containing expected prop values', async () => {
    const html = await render(
      <TrialExpired
        userName="Eve Green"
        upgradeUrl="https://prical.io/upgrade"
      />
    )
    expect(html).toContain('Eve Green')
    expect(html).toMatch(/expired/i)
  })
})

import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import BookingRejected from './booking-rejected'

describe('BookingRejected email template', () => {
  it('renders to HTML containing expected prop values including rejection reason', async () => {
    const html = await render(
      <BookingRejected
        inviteeName="Bob Jones"
        inviteeEmail="bob@example.com"
        eventTypeName="Consultation"
        eventTime="2026-04-02T14:00:00Z"
        rejectionReason="They were not on your allowlist"
        addToAllowlistUrl="https://prical.io/allowlist/add?email=bob@example.com"
      />
    )
    expect(html).toContain('Bob Jones')
    expect(html).toContain('bob@example.com')
    expect(html).toContain('They were not on your allowlist')
  })
})

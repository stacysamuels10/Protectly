import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import BookingApproved from './booking-approved'

describe('BookingApproved email template', () => {
  it('renders to HTML containing expected prop values', async () => {
    const html = await render(
      <BookingApproved
        inviteeName="Alice Smith"
        inviteeEmail="alice@example.com"
        eventTypeName="30 Min Call"
        eventTime="2026-04-01T10:00:00Z"
      />
    )
    expect(html).toContain('Alice Smith')
    expect(html).toContain('alice@example.com')
    expect(html).toContain('30 Min Call')
  })
})

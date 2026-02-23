import { describe, it, expect } from 'vitest'
import { evaluateGuestCheckMode } from './guest-check'

/**
 * Test data patterns (consistent across all modes):
 * - Approved invitee: inviteeApproved=true, no guests
 * - Approved guests (mixed): inviteeApproved=false, one approved + one unapproved guest
 * - Unapproved guests: inviteeApproved=true, one unapproved guest
 */

describe('ALLOW_ALL', () => {
  it('approves an approved invitee with no guests', () => {
    const result = evaluateGuestCheckMode('ALLOW_ALL', true, [], [], [])
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('approves even with mixed approved/unapproved guests', () => {
    const result = evaluateGuestCheckMode(
      'ALLOW_ALL',
      false,
      ['guest1@example.com'],
      ['guest2@example.com'],
      ['guest1@example.com', 'guest2@example.com'],
    )
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('approves even with unapproved guests', () => {
    const result = evaluateGuestCheckMode(
      'ALLOW_ALL',
      true,
      [],
      ['bad@example.com'],
      ['bad@example.com'],
    )
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })
})

describe('STRICT', () => {
  it('approves an approved invitee with no guests', () => {
    const result = evaluateGuestCheckMode('STRICT', true, [], [], [])
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('rejects an unapproved invitee even with mixed guests', () => {
    const result = evaluateGuestCheckMode(
      'STRICT',
      false,
      ['guest1@example.com'],
      ['guest2@example.com'],
      ['guest1@example.com', 'guest2@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: 'Email not on allowlist',
      useGuestCancelMessage: false,
    })
  })

  it('rejects an approved invitee with unapproved guests', () => {
    const result = evaluateGuestCheckMode(
      'STRICT',
      true,
      [],
      ['bad@example.com'],
      ['bad@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: 'Unapproved guest(s): bad@example.com',
      useGuestCancelMessage: true,
    })
  })
})

describe('PRIMARY_ONLY', () => {
  it('approves an approved invitee', () => {
    const result = evaluateGuestCheckMode('PRIMARY_ONLY', true, [], [], [])
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('rejects an unapproved invitee regardless of guests', () => {
    const result = evaluateGuestCheckMode(
      'PRIMARY_ONLY',
      false,
      ['guest1@example.com'],
      ['guest2@example.com'],
      ['guest1@example.com', 'guest2@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: 'Email not on allowlist',
      useGuestCancelMessage: false,
    })
  })

  it('approves an approved invitee even with unapproved guests', () => {
    const result = evaluateGuestCheckMode(
      'PRIMARY_ONLY',
      true,
      [],
      ['bad@example.com'],
      ['bad@example.com'],
    )
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })
})

describe('ANY_APPROVED', () => {
  it('approves an approved invitee', () => {
    const result = evaluateGuestCheckMode('ANY_APPROVED', true, [], [], [])
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('approves an unapproved invitee when at least one guest is approved', () => {
    const result = evaluateGuestCheckMode(
      'ANY_APPROVED',
      false,
      ['guest1@example.com'],
      ['guest2@example.com'],
      ['guest1@example.com', 'guest2@example.com'],
    )
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('rejects when no participants are approved', () => {
    const result = evaluateGuestCheckMode(
      'ANY_APPROVED',
      false,
      [],
      ['bad@example.com'],
      ['bad@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: 'No participants on allowlist',
      useGuestCancelMessage: false,
    })
  })
})

describe('NO_GUESTS', () => {
  it('approves an approved invitee with no guests', () => {
    const result = evaluateGuestCheckMode('NO_GUESTS', true, [], [], [])
    expect(result).toEqual({ isApproved: true, rejectionReason: '', useGuestCancelMessage: false })
  })

  it('rejects an unapproved invitee', () => {
    const result = evaluateGuestCheckMode(
      'NO_GUESTS',
      false,
      ['guest1@example.com'],
      ['guest2@example.com'],
      ['guest1@example.com', 'guest2@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: 'Email not on allowlist',
      useGuestCancelMessage: false,
    })
  })

  it('rejects an approved invitee when guests are present', () => {
    const result = evaluateGuestCheckMode(
      'NO_GUESTS',
      true,
      [],
      ['bad@example.com'],
      ['bad@example.com'],
    )
    expect(result).toEqual({
      isApproved: false,
      rejectionReason: expect.stringContaining('Additional guests not allowed'),
      useGuestCancelMessage: true,
    })
  })
})

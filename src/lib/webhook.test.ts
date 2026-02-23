import crypto from 'crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyWebhookSignature, isTimestampValid } from './webhook'

/**
 * Helper: create a valid Calendly webhook signature header.
 * Mirrors the HMAC-SHA256 signing algorithm used by Calendly.
 */
function makeValidSignature(
  payload: string,
  key: string,
  timestampSec?: number,
): string {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000)
  const signedPayload = `${ts}.${payload}`
  const sig = crypto
    .createHmac('sha256', key)
    .update(signedPayload, 'utf8')
    .digest('hex')
  return `t=${ts},v1=${sig}`
}

describe('verifyWebhookSignature', () => {
  const key = 'test-webhook-signing-key'
  const payload = '{"event":"invitee.created","payload":{"email":"test@example.com"}}'

  it('accepts a valid signature', () => {
    const header = makeValidSignature(payload, key)
    expect(verifyWebhookSignature(payload, header, key)).toBe(true)
  })

  it('rejects when key is wrong', () => {
    const header = makeValidSignature(payload, 'correct-key')
    expect(verifyWebhookSignature(payload, header, 'wrong-key')).toBe(false)
  })

  it('rejects when signature header is null', () => {
    expect(verifyWebhookSignature(payload, null, key)).toBe(false)
  })

  it('rejects when payload is tampered', () => {
    const header = makeValidSignature(payload, key)
    const tamperedPayload = '{"event":"invitee.created","payload":{"email":"hacker@evil.com"}}'
    expect(verifyWebhookSignature(tamperedPayload, header, key)).toBe(false)
  })
})

describe('isTimestampValid', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts timestamp 59 seconds old', () => {
    const frozenTime = new Date('2026-01-15T12:00:00Z')
    vi.setSystemTime(frozenTime)
    const frozenSec = Math.floor(frozenTime.getTime() / 1000)
    const ts = frozenSec - 59
    const header = `t=${ts},v1=fakesig`
    expect(isTimestampValid(header)).toBe(true)
  })

  it('rejects timestamp 61 seconds old', () => {
    const frozenTime = new Date('2026-01-15T12:00:00Z')
    vi.setSystemTime(frozenTime)
    const frozenSec = Math.floor(frozenTime.getTime() / 1000)
    const ts = frozenSec - 61
    const header = `t=${ts},v1=fakesig`
    expect(isTimestampValid(header)).toBe(false)
  })

  it('rejects when signature header is null', () => {
    expect(isTimestampValid(null)).toBe(false)
  })
})

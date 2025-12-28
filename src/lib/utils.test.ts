import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isValidEmail,
  getInitials,
  TIER_LIMITS,
} from './utils'

describe('cn (className merger)', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'active', false && 'hidden')).toBe('base active')
  })

  it('should merge Tailwind classes intelligently', () => {
    // tailwind-merge should handle conflicting classes
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('should handle arrays and objects', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
    expect(cn({ active: true, hidden: false })).toBe('active')
  })
})

describe('formatDate', () => {
  it('should format a Date object correctly', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    const result = formatDate(date)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
  })

  it('should format a date string correctly', () => {
    const result = formatDate('2024-06-20')
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/20/)
    expect(result).toMatch(/2024/)
  })
})

describe('formatDateTime', () => {
  it('should include time in the formatted output', () => {
    const date = new Date('2024-01-15T14:30:00')
    const result = formatDateTime(date)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2024/)
    // Should contain time component
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "just now" for times less than a minute ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const thirtySecondsAgo = new Date('2024-01-15T11:59:35')
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  it('should return minutes ago for times less than an hour ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const fiveMinutesAgo = new Date('2024-01-15T11:55:00')
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
  })

  it('should return hours ago for times less than a day ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const threeHoursAgo = new Date('2024-01-15T09:00:00')
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
  })

  it('should return days ago for times less than a week ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const twoDaysAgo = new Date('2024-01-13T12:00:00')
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago')
  })

  it('should return formatted date for times more than a week ago', () => {
    const now = new Date('2024-01-15T12:00:00')
    vi.setSystemTime(now)

    const twoWeeksAgo = new Date('2024-01-01T12:00:00')
    const result = formatRelativeTime(twoWeeksAgo)
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/1/)
    expect(result).toMatch(/2024/)
  })
})

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.org')).toBe(true)
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('notanemail')).toBe(false)
    expect(isValidEmail('missing@domain')).toBe(false)
    expect(isValidEmail('@nodomain.com')).toBe(false)
    expect(isValidEmail('spaces in@email.com')).toBe(false)
  })
})

describe('getInitials', () => {
  it('should return initials from a full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
    expect(getInitials('Alice Bob Charlie')).toBe('AB')
  })

  it('should return single initial for single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('should handle null or undefined', () => {
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('?')
  })

  it('should uppercase initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('should limit to 2 characters', () => {
    expect(getInitials('A B C D E')).toBe('AB')
  })
})

describe('TIER_LIMITS', () => {
  it('should have correct FREE tier limits', () => {
    expect(TIER_LIMITS.FREE.allowlistEntries).toBe(25)
    expect(TIER_LIMITS.FREE.eventTypes).toBe(1)
    expect(TIER_LIMITS.FREE.activityLogDays).toBe(30)
    expect(TIER_LIMITS.FREE.csvImport).toBe(false)
    expect(TIER_LIMITS.FREE.perEventAllowlist).toBe(false)
  })

  it('should have correct PRO tier limits', () => {
    expect(TIER_LIMITS.PRO.allowlistEntries).toBe(500)
    expect(TIER_LIMITS.PRO.eventTypes).toBe(Infinity)
    expect(TIER_LIMITS.PRO.csvImport).toBe(true)
    expect(TIER_LIMITS.PRO.perEventAllowlist).toBe(true)
  })

  it('should have correct BUSINESS tier limits', () => {
    expect(TIER_LIMITS.BUSINESS.allowlistEntries).toBe(2000)
    expect(TIER_LIMITS.BUSINESS.activityLogDays).toBe(365)
  })

  it('should have correct ENTERPRISE tier limits', () => {
    expect(TIER_LIMITS.ENTERPRISE.allowlistEntries).toBe(Infinity)
    expect(TIER_LIMITS.ENTERPRISE.activityLogDays).toBe(Infinity)
  })
})


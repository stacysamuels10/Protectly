import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return formatDate(d)
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Subscription tier limits
export const TIER_LIMITS = {
  FREE: {
    allowlistEntries: 25,
    eventTypes: 1,
    activityLogDays: 30,
    emailTemplates: 1,
    perEventAllowlist: false,
    csvImport: false,
  },
  PRO: {
    allowlistEntries: 500,
    eventTypes: Infinity,
    activityLogDays: 90,
    emailTemplates: 5,
    perEventAllowlist: true,
    csvImport: true,
  },
  BUSINESS: {
    allowlistEntries: 2000,
    eventTypes: Infinity,
    activityLogDays: 365,
    emailTemplates: Infinity,
    perEventAllowlist: true,
    csvImport: true,
  },
  ENTERPRISE: {
    allowlistEntries: Infinity,
    eventTypes: Infinity,
    activityLogDays: Infinity,
    emailTemplates: Infinity,
    perEventAllowlist: true,
    csvImport: true,
  },
} as const




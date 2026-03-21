import * as Sentry from '@sentry/nextjs'
import type { Event } from '@sentry/nextjs'

export function beforeSend(event: Event): Event {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    if (event.request.env) {
      delete event.request.env['REMOTE_ADDR']
    }
  }
  delete event.user
  return event
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend,
})

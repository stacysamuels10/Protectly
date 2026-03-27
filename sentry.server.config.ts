import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'

export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent {
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

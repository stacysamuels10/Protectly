import 'server-only'
import { PostHog } from 'posthog-node'

let _posthog: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!_posthog) {
    _posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return _posthog
}

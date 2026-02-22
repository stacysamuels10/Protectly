// middleware.ts — project root
// Rate limiting middleware using @upstash/ratelimit 2.0.8 + Next.js 15.5.9 Node.js runtime
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getIronSession } from 'iron-session'

export const config = {
  runtime: 'nodejs', // REQUIRED — iron-session uses Node.js crypto; stable in Next.js 15.5.9
  matcher: [
    '/api/auth/:path*',
    '/api/allowlists/:path*',
    '/api/billing/:path*',
    '/api/settings/:path*',
    '/api/dashboard/:path*',
    // /api/webhooks/:path* is intentionally EXCLUDED — webhook signature verification is
    // their security gate; rate limiting CDN IPs causes retry cascades
  ],
}

// Null when UPSTASH_REDIS_REST_URL is not set — graceful degradation in dev/test
// Read process.env directly (not env.ts) to avoid full env validation chain in middleware
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : null

const limiters = redis
  ? {
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'rl:auth',
        analytics: false, // analytics: false avoids doubling Redis command count
      }),
      allowlistWrites: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'rl:allowlist-writes',
        analytics: false,
      }),
      general: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        prefix: 'rl:general',
        analytics: false,
      }),
    }
  : null

function getIP(request: NextRequest): string {
  // request.ip was REMOVED in Next.js 15 — use x-forwarded-for
  // First IP in the header is the real client IP on Vercel; fallback to localhost in dev
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Graceful degradation: no Upstash credentials → allow all requests
  if (!limiters) return NextResponse.next()

  const path = request.nextUrl.pathname
  const ip = getIP(request)
  const method = request.method

  let identifier: string
  let limiter: Ratelimit

  if (path.startsWith('/api/auth')) {
    // Auth endpoints: per-IP limit (10/min)
    identifier = `ip:${ip}`
    limiter = limiters.auth
  } else if (
    path.startsWith('/api/allowlists') &&
    (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')
  ) {
    // Allowlist write mutations: per-user limit (30/min)
    // Read userId from iron-session cookie — works because runtime is 'nodejs'
    // Use process.env.SESSION_SECRET directly (not env.ts) to avoid validation chain
    let userId: string | undefined
    try {
      const session = await getIronSession<{ userId?: string }>(
        request,
        new Response(),
        {
          password: process.env.SESSION_SECRET!,
          cookieName: 'prical_session',
        }
      )
      userId = session.userId
    } catch {
      // If session read fails, fall back to IP-based limiting — safe degradation
      userId = undefined
    }
    identifier = userId ? `user:${userId}` : `ip:${ip}`
    limiter = limiters.allowlistWrites
  } else {
    // All other matched routes (billing, settings, dashboard, allowlist reads): general (120/min)
    identifier = `ip:${ip}`
    limiter = limiters.general
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  return NextResponse.next()
}

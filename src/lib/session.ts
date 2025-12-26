import { getIronSession, IronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  isLoggedIn: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'prical_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)

  if (!session.isLoggedIn) {
    session.isLoggedIn = false
  }

  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  
  if (!session.isLoggedIn || !session.userId) {
    return null
  }

  // Import prisma here to avoid circular dependency
  const { prisma } = await import('./prisma')
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      calendlyUserUri: true,
      cancelMessage: true,
      guestCheckMode: true,
      guestCancelMessage: true,
      createdAt: true,
    },
  })

  return user
}



import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import type { Plan, Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      plan: Plan
      role: Role
      onboardingComplete: boolean
      skippedDnaSetup: boolean
    }
  }
}

/**
 * Edge-safe auth config (NO Prisma, bcrypt, or other Node-only deps).
 * The middleware (proxy.ts) builds a NextAuth instance from this so it can
 * verify the JWT session on Vercel's edge runtime. The full config in
 * lib/auth.ts spreads this and adds the Prisma adapter, the Credentials
 * provider, and the DB-enriched session - all of which run only in Node.
 */
export const authConfig = {
  // Trust the incoming host so session cookies + OAuth callbacks use the real
  // request domain (e.g. bastudiopodcast.com) behind Vercel's proxy, instead of
  // bouncing when the canonical host can't be inferred.
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Google verifies email ownership, so it's safe to link a Google sign-in
      // to an existing same-email account (e.g. one created with a password).
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: { scope: 'openid email profile' },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/?signin=1',
    error: '/?autherror=1',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.email) token.email = user.email
      return token
    },
  },
} satisfies NextAuthConfig

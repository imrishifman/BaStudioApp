import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import Google from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: 'Ba-Studio <noreply@ba-studio.com>',
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/calendar',
        },
      },
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/?signin=1',
    verifyRequest: '/auth/verify',
    error: '/?autherror=1',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      // Auto-create User row on first sign-in
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          fullName: user.name ?? undefined,
          image: user.image ?? undefined,
        },
        update: {},
      })
      return true
    },
    async session({ session, user }) {
      if (session.user && user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: {
            id: true,
            plan: true,
            role: true,
            onboardingComplete: true,
            skippedDnaSetup: true,
          },
        })
        if (dbUser) {
          session.user.id = dbUser.id
          session.user.plan = dbUser.plan
          session.user.role = dbUser.role
          session.user.onboardingComplete = dbUser.onboardingComplete
          session.user.skippedDnaSetup = dbUser.skippedDnaSetup
        }
      }
      return session
    },
  },
})

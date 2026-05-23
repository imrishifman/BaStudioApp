import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Resend from 'next-auth/providers/resend'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
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
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim()
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.image,
        }
      },
    }),
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
  // Credentials provider requires JWT sessions (database sessions are not
  // supported with credentials). Magic-link and Google work with JWT too.
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/?signin=1',
    verifyRequest: '/auth/verify',
    error: '/?autherror=1',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      // Auto-create a User row on first OAuth/magic-link sign-in.
      // Credentials sign-ins already have a row (created at signup).
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
    async jwt({ token, user }) {
      // On initial sign-in, persist the email onto the token.
      if (user?.email) token.email = user.email
      return token
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            email: true,
            plan: true,
            role: true,
            onboardingComplete: true,
            skippedDnaSetup: true,
          },
        })
        if (dbUser) {
          session.user.id = dbUser.id
          session.user.email = dbUser.email
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

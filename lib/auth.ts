import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
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
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false
      // Auto-create a User row on first OAuth sign-in.
      // Credentials sign-ins already have a row (created at signup).
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      })
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          fullName: user.name ?? undefined,
          image: user.image ?? undefined,
        },
        update: {},
      })
      // First-ever OAuth sign-in = a new account. Drop a one-shot cookie so the
      // client fires the `sign_up` conversion once after the redirect lands.
      // Best-effort: never block sign-in if cookie writing isn't available.
      if (!existing) {
        try {
          const { cookies } = await import('next/headers')
          const jar = await cookies()
          jar.set('ba_signup_method', 'google', {
            path: '/',
            maxAge: 300,
            sameSite: 'lax',
          })
        } catch (err) {
          console.error('Could not set signup cookie for new OAuth user:', err)
        }
      }
      return true
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

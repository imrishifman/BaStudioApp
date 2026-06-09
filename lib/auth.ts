import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authConfig } from './auth.config'
import { sendTrialWelcomeEmail } from '@/lib/email/trial'
import { TRIAL_LENGTH_MS, effectivePlan, isTrialActive } from '@/lib/trial'

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
      // New Google accounts start the same 7-day reverse trial as email
      // signups. Existing users are untouched (update: {}).
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          fullName: user.name ?? undefined,
          image: user.image ?? undefined,
          plan: 'solo',
          planStatus: 'trialing',
          planOverride: true,
          trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
          subscriptionStart: new Date(),
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
        // Day-0 trial welcome email for the brand-new Google account.
        void sendTrialWelcomeEmail(user.email, user.name?.split(' ')[0] ?? null)
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
            planStatus: true,
            planOverride: true,
            trialEndsAt: true,
            stripeSubscriptionId: true,
            trialEndedNoticeShown: true,
            trialWelcomeSeen: true,
            role: true,
            onboardingComplete: true,
            skippedDnaSetup: true,
          },
        })
        if (dbUser) {
          const now = Date.now()
          session.user.id = dbUser.id
          session.user.email = dbUser.email
          // Enforce the EFFECTIVE plan: an expired-but-not-yet-downgraded trial
          // reads as 'free' immediately, so gates revoke the instant the clock
          // passes the end date (before the daily cron rewrites the row).
          session.user.plan = effectivePlan(dbUser, now) as typeof dbUser.plan
          session.user.role = dbUser.role
          session.user.onboardingComplete = dbUser.onboardingComplete
          session.user.skippedDnaSetup = dbUser.skippedDnaSetup
          session.user.trialEndsAt = dbUser.trialEndsAt ? dbUser.trialEndsAt.toISOString() : null
          session.user.isTrialActive = isTrialActive(dbUser, now)
          // First-sign-in "Claim your 7 days" prompt: active trial, not yet seen.
          session.user.showTrialWelcome = isTrialActive(dbUser, now) && !dbUser.trialWelcomeSeen
          // Show the expiry modal exactly once: a trial existed, it's past its
          // end, the effective plan is now free, and the notice is unseen.
          session.user.showTrialEndedNotice =
            !!dbUser.trialEndsAt &&
            now > new Date(dbUser.trialEndsAt).getTime() &&
            effectivePlan(dbUser, now) === 'free' &&
            !dbUser.trialEndedNoticeShown
        }
      }
      return session
    },
  },
})

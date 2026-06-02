import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

// Landing point after the Stripe-hosted onboarding (both the success return and
// the "refresh" retry). We re-check the connected account and flip
// stripeOnboardingCompleted once Stripe can send the partner payouts, then
// bounce the user back to the partner portal.
export async function GET(req: Request) {
  const session = await auth()
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudiopodcast.com'
  if (!session) return NextResponse.redirect(`${base}/?signin=1`)

  const email = session.user.email.toLowerCase()
  const influencer = await prisma.influencer.findFirst({ where: { email } })

  if (influencer?.stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(influencer.stripeAccountId)
      const ready = !!account.payouts_enabled && !!account.details_submitted
      if (ready && !influencer.stripeOnboardingCompleted) {
        await prisma.influencer.update({
          where: { id: influencer.id },
          data: { stripeOnboardingCompleted: true },
        })
      }
    } catch {
      // Non-fatal: just send them back; they can retry the connect button.
    }
  }

  return NextResponse.redirect(`${base}/partner?tab=payouts`)
}

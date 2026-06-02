import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'

// Starts (or resumes) Stripe Connect Express onboarding for the logged-in
// partner. Works for individuals — Stripe collects their personal details,
// government ID, and bank account during the hosted flow; no registered
// business is required. Returns a one-time onboarding URL to redirect to.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
  } catch {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }

  const email = session.user.email.toLowerCase()
  const influencer = await prisma.influencer.findFirst({ where: { email } })
  if (!influencer) return NextResponse.json({ error: 'Not a partner' }, { status: 403 })
  if (!influencer.agreementSigned) {
    return NextResponse.json({ error: 'Sign the partner agreement first' }, { status: 400 })
  }

  // All Stripe calls are wrapped so the partner sees the real reason (e.g.
  // "Connect is not enabled on this account") instead of a generic network
  // error from an unhandled 500 with a non-JSON body.
  try {
    let accountId = influencer.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: influencer.email ?? undefined,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        metadata: { influencerId: influencer.id },
      })
      accountId = account.id
      await prisma.influencer.update({
        where: { id: influencer.id },
        data: { stripeAccountId: accountId, stripeOnboardingSent: true },
      })
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudiopodcast.com'
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/api/stripe/connect/return?refresh=1`,
      return_url: `${base}/api/stripe/connect/return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: link.url })
  } catch (err) {
    console.error('Stripe Connect onboarding failed:', err)
    const message = err instanceof Error ? err.message : 'Could not start Stripe onboarding'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'
import { resolvePriceId } from '@/lib/stripe-config'

export const maxDuration = 30

// Creates a Stripe Checkout Session for a given plan + billing period.
// Returns { url } - the client redirects there.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
    const { plan, period } = (await req.json()) as {
      plan: 'solo' | 'master'
      period: 'monthly' | 'annual'
    }
    if (!plan || !period) return NextResponse.json({ error: 'plan and period required' }, { status: 400 })

    const priceId = resolvePriceId(plan, period)
    if (!priceId) {
      return NextResponse.json({ error: `Price not configured for ${plan}/${period}` }, { status: 500 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Reuse existing Stripe customer if we've seen them before; otherwise let
    // Checkout create one from the customer_email and write it back via webhook.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const params: import('stripe').Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      subscription_data: { metadata: { userId: user.id, email: user.email } },
      metadata: { userId: user.id, email: user.email },
    }
    if (user.stripeCustomerId) params.customer = user.stripeCustomerId
    else params.customer_email = user.email

    const checkout = await stripe.checkout.sessions.create(params)
    return NextResponse.json({ url: checkout.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    const message = err instanceof Error ? err.message : 'Could not start checkout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'
import { resolvePriceId } from '@/lib/stripe-config'
import { findInfluencerByRefCode } from '@/lib/referrals'

export const maxDuration = 30

// Creates a Stripe Checkout Session for a given plan + billing period.
// Returns { url } - the client redirects there.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
    const { plan, period, returnTo } = (await req.json()) as {
      plan: 'solo' | 'master'
      period: 'monthly' | 'annual'
      returnTo?: string
    }
    if (!plan || !period) return NextResponse.json({ error: 'plan and period required' }, { status: 400 })
    // Deep-link return: only accept a same-site relative path (starts with a
    // single "/"), never an absolute URL, to avoid open-redirects.
    const safeReturnTo =
      typeof returnTo === 'string' && /^\/(?!\/)/.test(returnTo) ? returnTo : null

    const priceId = resolvePriceId(plan, period)
    if (!priceId) {
      return NextResponse.json({ error: `Price not configured for ${plan}/${period}` }, { status: 500 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Affiliate attribution: prefer an existing first-touch attribution row
    // (created at signup); fall back to the current bas_ref cookie. Either way,
    // we stamp influencerId into Stripe metadata so the webhook can credit
    // the right partner even months later.
    let influencerId: string | null = null
    let attributionSource: 'attribution_row' | 'cookie' | 'none' = 'none'
    const existingAttr = await prisma.referralAttribution.findUnique({
      where: { userEmail: user.email },
      select: { influencerId: true },
    })
    if (existingAttr) {
      influencerId = existingAttr.influencerId
      attributionSource = 'attribution_row'
    } else {
      const ck = await cookies()
      const refCode = ck.get('bas_ref')?.value
      if (refCode) {
        const inf = await findInfluencerByRefCode(refCode)
        if (inf && inf.email?.toLowerCase() !== user.email.toLowerCase()) {
          influencerId = inf.id
          attributionSource = 'cookie'
        }
      }
    }

    // Reuse existing Stripe customer if we've seen them before; otherwise let
    // Checkout create one from the customer_email and write it back via webhook.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const subMetadata: Record<string, string> = { userId: user.id, email: user.email }
    if (influencerId) {
      subMetadata.influencerId = influencerId
      subMetadata.attributionSource = attributionSource
    }
    // Pre-apply the attributed influencer's discount, if they have a LIVE promo
    // (couponActive + a Stripe promotion code). Stripe forbids `discounts`
    // together with `allow_promotion_codes`, so we branch: auto-applied promo
    // when attribution carries one, otherwise the manual promo-code field.
    // Attribution-only codes (no customer discount) skip this entirely.
    let autoPromoId: string | null = null
    if (influencerId) {
      const inf = await prisma.influencer.findUnique({
        where: { id: influencerId },
        select: { stripePromotionCodeId: true, couponActive: true },
      })
      if (inf?.couponActive && inf.stripePromotionCodeId) autoPromoId = inf.stripePromotionCodeId
    }

    const params: import('stripe').Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // After payment land back where the user was (deep-link return) when a
      // safe returnTo was supplied; otherwise the billing page. The
      // start_subscription conversion still fires from the billing page, so we
      // route through it either way and carry the deep link in `next`.
      success_url: safeReturnTo
        ? `${baseUrl}/account/billing?success=1&session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(safeReturnTo)}`
        : `${baseUrl}/account/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?canceled=1`,
      client_reference_id: user.id,
      subscription_data: { metadata: subMetadata },
      metadata: subMetadata,
      ...(autoPromoId
        ? { discounts: [{ promotion_code: autoPromoId }] }
        : { allow_promotion_codes: true }),
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

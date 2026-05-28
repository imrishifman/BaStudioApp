import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getPriceMap, mapStripeStatus } from '@/lib/stripe-config'

export const maxDuration = 30
// Webhook handlers MUST read the raw request body to verify the signature,
// so this route runs on Node.js (not Edge) and disables the default parsing.
export const runtime = 'nodejs'

// Resolve our user by Stripe customer id OR by metadata.userId fallback.
async function findUser(customerId: string | null, fallbackUserId?: string | null) {
  if (customerId) {
    const u = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
    if (u) return u
  }
  if (fallbackUserId) {
    return prisma.user.findUnique({ where: { id: fallbackUserId } })
  }
  return null
}

// Create an InfluencerConversion row when an attributed user completes a
// paid subscription. Idempotent: a unique-ish key of (influencerId,
// subscriptionId, planPurchased) is enforced at the app layer because the
// model has no compound unique constraint yet (kept loose for v1).
async function recordInfluencerConversion(
  userId: string,
  sub: Stripe.Subscription,
  user: { email: string },
) {
  const influencerId = (sub.metadata?.influencerId as string | undefined) ?? null
  if (!influencerId) return

  // Resolve plan + price from the subscription's first item.
  const item = sub.items.data[0]
  if (!item) return
  const priceId = item.price.id
  const map = getPriceMap()
  const meta = map[priceId]
  if (!meta) return // unknown price - skip
  const revenueAmount = (item.price.unit_amount ?? 0) / 100

  // Idempotency: skip if we've already recorded this subscription.
  const existing = await prisma.influencerConversion.findFirst({
    where: { influencerId, couponCodeUsed: sub.id },
    select: { id: true },
  })
  if (existing) return

  // Snapshot commission at conversion time so later edits to the influencer's
  // commission rate don't retroactively change owed amounts.
  const influencer = await prisma.influencer.findUnique({
    where: { id: influencerId },
    select: { commissionType: true, commissionValue: true, status: true, email: true },
  })
  if (!influencer || influencer.status !== 'active') return
  // Anti-self: never credit the influencer for their own purchase.
  if (influencer.email && influencer.email.toLowerCase() === user.email.toLowerCase()) return

  let commissionEarned: number | null = null
  if (influencer.commissionType === 'percentage' && influencer.commissionValue) {
    commissionEarned = +(revenueAmount * (influencer.commissionValue / 100)).toFixed(2)
  } else if (influencer.commissionType === 'fixed' && influencer.commissionValue) {
    commissionEarned = influencer.commissionValue
  }

  await prisma.influencerConversion.create({
    data: {
      influencerId,
      convertedUserEmail: user.email,
      planPurchased: meta.plan,
      revenueAmount,
      commissionEarned,
      // Re-using couponCodeUsed as the subscription anchor for idempotency.
      // A dedicated stripeSubscriptionId column would be cleaner; deferring
      // the schema change to keep this commit tight.
      couponCodeUsed: sub.id,
      notes: `auto · ${(sub.metadata?.attributionSource as string) ?? 'unknown'}`,
    },
  })
}

// Apply a subscription snapshot to the User row. Single source of truth for
// every subscription-touching event.
async function applySubscriptionToUser(userId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null
  const map = getPriceMap()
  const meta = priceId ? map[priceId] : null
  // sub.current_period_end is on Stripe.Subscription.Item in newer API versions,
  // and on the parent Subscription in older ones. Try both for safety.
  const periodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null
  const status = mapStripeStatus(sub.status)
  // If sub is canceled outright (not cancel-at-period-end), drop the user to free.
  const isCanceled = sub.status === 'canceled' || sub.status === 'incomplete_expired'

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan: isCanceled ? 'free' : (meta?.plan ?? 'free'),
      planStatus: status,
      billingPeriod: meta?.period ?? null,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      subscriptionStart: sub.start_date ? new Date(sub.start_date * 1000) : undefined,
      subscriptionRenewedAt: new Date(),
    },
  })
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  // Raw body is required for signature verification.
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        const userId = (s.metadata?.userId as string | undefined) ?? s.client_reference_id ?? null
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null
        if (!userId) break

        // Persist the customer id so we can look up by it next time.
        if (customerId) {
          await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
        }
        // Pull the subscription and apply.
        if (typeof s.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(s.subscription)
          await applySubscriptionToUser(userId, sub)
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
          if (user) await recordInfluencerConversion(userId, sub, user)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const fallbackUserId = (sub.metadata?.userId as string | undefined) ?? null
        const user = await findUser(customerId, fallbackUserId)
        if (user) await applySubscriptionToUser(user.id, sub)
        break
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
        const user = await findUser(customerId)
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { planStatus: 'past_due' },
          })
        }
        break
      }

      default:
        // Many event types are fine to ignore (e.g. payment_method.*).
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }
}

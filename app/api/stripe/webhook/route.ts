import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'
import type { Plan } from '@prisma/client'


const PRICE_MAP: Record<string, { plan: Plan; billing: 'monthly' | 'annual' }> = {
  [process.env.STRIPE_PRICE_SOLO_MONTHLY ?? 'price_1TWOCWAqDyTKiar5Mu5QSC4s']: { plan: 'solo', billing: 'monthly' },
  [process.env.STRIPE_PRICE_SOLO_ANNUAL ?? 'price_1TWOCWAqDyTKiar5T0xP9v7Q']: { plan: 'solo', billing: 'annual' },
  [process.env.STRIPE_PRICE_MASTER_MONTHLY ?? 'price_1TWOCWAqDyTKiar5deS5KhUG']: { plan: 'master', billing: 'monthly' },
  [process.env.STRIPE_PRICE_MASTER_ANNUAL ?? 'price_1TWOCWAqDyTKiar5aIRqEFGn']: { plan: 'master', billing: 'annual' },
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id
        const planInfo = PRICE_MAP[priceId]
        if (!planInfo || !session.customer_email) break
        await prisma.user.updateMany({
          where: { email: session.customer_email },
          data: {
            plan: planInfo.plan,
            planStatus: 'active',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id,
            subscriptionStart: new Date(),
            billingPeriod: planInfo.billing,
          },
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id
        const planInfo = PRICE_MAP[priceId]
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'trialing' ? 'trialing'
          : sub.status === 'past_due' ? 'past_due'
          : 'cancelled'
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            plan: planInfo?.plan ?? 'free',
            planStatus: status,
            subscriptionRenewedAt: new Date(sub.billing_cycle_anchor * 1000),
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan: 'free', planStatus: 'cancelled', stripeSubscriptionId: null },
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoice.parent?.type === 'subscription_details'
          ? (invoice.parent.subscription_details?.subscription as string | undefined)
          : undefined
        if (!subId) break
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { planStatus: 'active', subscriptionRenewedAt: new Date() },
        })
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}

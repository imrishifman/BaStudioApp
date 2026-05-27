import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'
import { resolvePriceId } from '@/lib/stripe-config'

export const maxDuration = 30

// Upgrade or downgrade an existing subscription to a different price.
// Uses Stripe's automatic proration so the user is credited (or charged) for
// the portion of the current period.
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

    const newPriceId = resolvePriceId(plan, period)
    if (!newPriceId) {
      return NextResponse.json({ error: `Price not configured for ${plan}/${period}` }, { status: 500 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    const currentItem = sub.items.data[0]
    if (!currentItem) {
      return NextResponse.json({ error: 'Subscription has no items' }, { status: 500 })
    }

    if (currentItem.price.id === newPriceId) {
      return NextResponse.json({ error: 'Already on that plan' }, { status: 400 })
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    })

    // Webhook will write the final state; this preempts the UI flicker.
    await prisma.user.update({
      where: { id: user.id },
      data: { stripePriceId: newPriceId, plan, billingPeriod: period },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Stripe change-plan error:', err)
    const message = err instanceof Error ? err.message : 'Could not change plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

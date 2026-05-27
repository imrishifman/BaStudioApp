import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export const maxDuration = 30

// Cancels the active subscription at the end of the current billing period.
// The user keeps access until currentPeriodEnd; webhook flips status when
// the period closes.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { cancelAtPeriodEnd: true },
    })

    return NextResponse.json({
      ok: true,
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    })
  } catch (err) {
    console.error('Stripe cancel error:', err)
    const message = err instanceof Error ? err.message : 'Could not cancel subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

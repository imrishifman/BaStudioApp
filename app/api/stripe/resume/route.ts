import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export const maxDuration = 30

// Undo a pending cancellation: flips cancel_at_period_end back to false while
// the subscription is still in its current paid period.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No subscription to resume' }, { status: 400 })
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { cancelAtPeriodEnd: false },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Stripe resume error:', err)
    const message = err instanceof Error ? err.message : 'Could not resume subscription'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

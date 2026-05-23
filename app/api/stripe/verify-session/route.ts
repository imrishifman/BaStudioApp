import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type { Plan } from '@prisma/client'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (checkoutSession.payment_status !== 'paid' && checkoutSession.status !== 'complete') {
      return NextResponse.json({ success: false })
    }

    const sub = checkoutSession.subscription as { id: string; items: { data: { price: { id: string } }[] } } | null
    if (!sub) return NextResponse.json({ success: false })

    const priceId = sub.items.data[0]?.price.id
    const PRICE_IDS = {
      [process.env.STRIPE_PRICE_SOLO_MONTHLY ?? 'price_1TWOCWAqDyTKiar5Mu5QSC4s']: { plan: 'solo' as Plan, billing: 'monthly' },
      [process.env.STRIPE_PRICE_SOLO_ANNUAL ?? 'price_1TWOCWAqDyTKiar5T0xP9v7Q']: { plan: 'solo' as Plan, billing: 'annual' },
      [process.env.STRIPE_PRICE_MASTER_MONTHLY ?? 'price_1TWOCWAqDyTKiar5deS5KhUG']: { plan: 'master' as Plan, billing: 'monthly' },
      [process.env.STRIPE_PRICE_MASTER_ANNUAL ?? 'price_1TWOCWAqDyTKiar5aIRqEFGn']: { plan: 'master' as Plan, billing: 'annual' },
    }

    const planInfo = PRICE_IDS[priceId]
    if (!planInfo) return NextResponse.json({ success: false })

    const customerId = checkoutSession.customer as string
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        plan: planInfo.plan,
        planStatus: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        subscriptionStart: new Date(),
        billingPeriod: planInfo.billing as 'monthly' | 'annual',
      },
    })

    const planLabels: Record<Plan, string> = { free: 'Free', solo: 'Studio Solo', master: 'Master' }

    return NextResponse.json({ success: true, planName: planLabels[planInfo.plan] })
  } catch (err) {
    console.error('Verify session error:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

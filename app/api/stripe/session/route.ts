import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'
import { getPriceMap } from '@/lib/stripe-config'

export const maxDuration = 30

// Returns the confirmed details of a completed Checkout Session so the client
// can fire the `start_subscription` conversion with a real amount, plan, and a
// unique transaction id. We read the amount straight from Stripe (source of
// truth) rather than trusting anything from the client, and we verify the
// session belongs to the signed-in user before returning anything.
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = new URL(req.url).searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  try {
    ensureStripeConfigured()

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const checkout = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'subscription'],
    })

    // Ownership check: the session must belong to this user.
    const ownerId = checkout.client_reference_id ?? checkout.metadata?.userId
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only report a real, paid purchase.
    if (checkout.payment_status !== 'paid') {
      return NextResponse.json({ paid: false })
    }

    const priceId = checkout.line_items?.data?.[0]?.price?.id ?? null
    const meta = priceId ? getPriceMap()[priceId] : undefined
    const plan = meta?.plan === 'solo' ? 'studio_solo' : (meta?.plan ?? 'unknown')

    const subscription = checkout.subscription
    const transactionId =
      typeof subscription === 'string' ? subscription : subscription?.id ?? checkout.id

    return NextResponse.json({
      paid: true,
      // amount_total is in the smallest currency unit (cents); convert to a
      // plain number with no symbol for the conversion value.
      value: typeof checkout.amount_total === 'number' ? checkout.amount_total / 100 : 0,
      currency: (checkout.currency ?? 'usd').toUpperCase(),
      plan,
      billingPeriod: meta?.period ?? 'monthly',
      transactionId,
      userId: user.id,
      // Used client-side only to build the SHA-256 enhanced-conversion hash.
      // Prefer the email Stripe collected at checkout, fall back to the account
      // email. The raw value never leaves the browser unhashed.
      email: checkout.customer_details?.email ?? user.email ?? undefined,
    })
  } catch (err) {
    console.error('Stripe session lookup error:', err)
    const message = err instanceof Error ? err.message : 'Could not load session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

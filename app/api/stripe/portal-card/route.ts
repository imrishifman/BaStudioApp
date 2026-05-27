import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export const maxDuration = 30

// One-shot redirect to Stripe's hosted Billing Portal for card updates.
// Everything else (cancel, change plan, view invoices) is in-app; this exists
// because rebuilding PCI-compliant card forms is not worth the engineering
// trade-off for v1.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    ensureStripeConfigured()
    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'No customer on file' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/account/billing`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err) {
    console.error('Stripe portal-card error:', err)
    const message = err instanceof Error ? err.message : 'Could not open billing portal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

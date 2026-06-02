import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'

// Admin-triggered payout: transfers the influencer's unpaid commission to their
// connected Stripe account, records a PayoutLog, and marks the covered
// conversions as paid. Money movement happens only when an admin clicks "Pay
// out" in the admin panel.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    ensureStripeConfigured()
  } catch {
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }

  const { id } = await params
  const influencer = await prisma.influencer.findUnique({ where: { id } })
  if (!influencer) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
  if (!influencer.stripeAccountId || !influencer.stripeOnboardingCompleted) {
    return NextResponse.json({ error: 'Partner has not finished Stripe onboarding' }, { status: 400 })
  }

  const unpaid = await prisma.influencerConversion.findMany({
    where: { influencerId: id, commissionPaid: false, commissionEarned: { gt: 0 } },
    select: { id: true, commissionEarned: true },
  })
  const amount = +unpaid.reduce((sum, c) => sum + (c.commissionEarned ?? 0), 0).toFixed(2)
  if (unpaid.length === 0 || amount <= 0) {
    return NextResponse.json({ error: 'No unpaid commission to send' }, { status: 400 })
  }

  let transferId: string
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: influencer.stripeAccountId,
      metadata: { influencerId: id, conversions: String(unpaid.length) },
    })
    transferId = transfer.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe transfer failed'
    await prisma.payoutLog.create({
      data: {
        payoutDate: new Date(),
        influencerId: id,
        influencerName: influencer.name,
        amountUsd: amount,
        conversionsPaid: unpaid.length,
        status: 'failed',
        errorMessage: message,
        triggeredBy: session.user.email,
      },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Transfer succeeded: mark conversions paid and log the payout atomically.
  await prisma.$transaction([
    prisma.influencerConversion.updateMany({
      where: { id: { in: unpaid.map((c) => c.id) } },
      data: { commissionPaid: true },
    }),
    prisma.payoutLog.create({
      data: {
        payoutDate: new Date(),
        influencerId: id,
        influencerName: influencer.name,
        amountUsd: amount,
        stripeTransferId: transferId,
        conversionsPaid: unpaid.length,
        status: 'success',
        triggeredBy: session.user.email,
      },
    }),
  ])

  return NextResponse.json({ ok: true, amount, conversionsPaid: unpaid.length, transferId })
}

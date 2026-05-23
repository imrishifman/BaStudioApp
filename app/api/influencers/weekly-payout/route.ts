import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unpaid = await prisma.influencerConversion.findMany({
    where: { commissionPaid: false },
    include: { influencer: true },
  })

  const byInfluencer = new Map<string, { influencer: typeof unpaid[0]['influencer']; amount: number; ids: string[] }>()

  for (const conv of unpaid) {
    const key = conv.influencerId
    if (!byInfluencer.has(key)) {
      byInfluencer.set(key, { influencer: conv.influencer, amount: 0, ids: [] })
    }
    const entry = byInfluencer.get(key)!
    entry.amount += conv.commissionEarned ?? 0
    entry.ids.push(conv.id)
  }

  const results: { influencerId: string; status: string; amount?: number; error?: string }[] = []

  for (const [influencerId, { influencer, amount, ids }] of byInfluencer) {
    if (!influencer.stripeAccountId) {
      results.push({ influencerId, status: 'skipped_no_connect' })
      continue
    }
    try {
      await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination: influencer.stripeAccountId,
        description: 'Weekly commission payout',
      })
      await prisma.influencerConversion.updateMany({ where: { id: { in: ids } }, data: { commissionPaid: true } })
      await prisma.payoutLog.create({
        data: {
          influencerId,
          payoutDate: new Date(),
          amountUsd: amount,
          conversionsPaid: ids.length,
          status: 'success',
        },
      })
      results.push({ influencerId, status: 'paid', amount })
    } catch (e: unknown) {
      results.push({ influencerId, status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ results })
}

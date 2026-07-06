import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PartnerClient } from './partner-client'
import { GlassCard } from '@/components/common/GlassCard'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { periodOf } from '@/lib/commission/engine'

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default async function PartnerPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  const userEmail = session.user.email.toLowerCase()

  // Match the influencer to the logged-in user by email. Once we wire
  // Influencer.userId in a future migration we can switch to that lookup.
  const influencer = await prisma.influencer.findFirst({
    where: { email: userEmail },
  })

  // Non-influencer user — show the join-the-program landing instead of a 404
  // so they can sign up via the public application form (Phase 3).
  if (!influencer) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
        <GlassCard className="space-y-4 p-8 text-center">
          <h1 className="display-sm text-[var(--ink-1)]">You&apos;re not a partner yet</h1>
          <p className="body text-[var(--ink-2)]">
            The Ba Studio Partner program rewards creators who refer paying podcasters.
            Apply to join and earn a recurring share of every customer you bring in.
          </p>
          <div className="flex justify-center">
            <Link href="/partners" className="pill-primary">
              Become a partner <ArrowRight size={14} />
            </Link>
          </div>
        </GlassCard>
      </div>
    )
  }

  // Parallel fetch all data the portal needs. Aggregated here on the server so
  // the client component renders fully populated on first paint - no spinners.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [
    clicksLast30,
    clicksTotal,
    attributionsTotal,
    conversions,
    payouts,
    unpaidAgg,
    paidAgg,
  ] = await Promise.all([
    prisma.referralClick.count({
      where: { influencerId: influencer.id, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.referralClick.count({ where: { influencerId: influencer.id } }),
    prisma.referralAttribution.count({ where: { influencerId: influencer.id } }),
    prisma.influencerConversion.findMany({
      where: { influencerId: influencer.id },
      orderBy: { conversionDate: 'desc' },
      take: 50,
    }),
    prisma.payoutLog.findMany({
      where: { influencerId: influencer.id },
      orderBy: { payoutDate: 'desc' },
      take: 50,
    }),
    prisma.influencerConversion.aggregate({
      where: { influencerId: influencer.id, commissionPaid: false },
      _sum: { commissionEarned: true },
    }),
    prisma.influencerConversion.aggregate({
      where: { influencerId: influencer.id, commissionPaid: true },
      _sum: { commissionEarned: true },
    }),
  ])

  // Construct the canonical referral URL the influencer should share.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudiopodcast.com'
  const referralUrl = influencer.couponCode
    ? `${baseUrl}/?ref=${influencer.couponCode}`
    : null

  const stats = {
    clicksLast30,
    clicksTotal,
    attributionsTotal,
    conversionCount: conversions.length,
    unpaidCommission: +(unpaidAgg._sum.commissionEarned ?? 0).toFixed(2),
    paidCommission: +(paidAgg._sum.commissionEarned ?? 0).toFixed(2),
    totalEarned: +((unpaidAgg._sum.commissionEarned ?? 0) + (paidAgg._sum.commissionEarned ?? 0)).toFixed(2),
  }

  // Studio commission ledger (the new event-based 20% of collected gross).
  // Separate from the legacy influencer conversions above.
  const period = periodOf(new Date())
  const [scMonth, scTotal, scPending, scHistory, referredActive] = await Promise.all([
    prisma.commissionEvent.aggregate({ where: { recipientType: 'studio', recipientId: influencer.id, period }, _sum: { amount: true } }),
    prisma.commissionEvent.aggregate({ where: { recipientType: 'studio', recipientId: influencer.id }, _sum: { amount: true } }),
    prisma.commissionEvent.aggregate({ where: { recipientType: 'studio', recipientId: influencer.id, status: 'pending' }, _sum: { amount: true } }),
    prisma.commissionEvent.groupBy({ by: ['period'], where: { recipientType: 'studio', recipientId: influencer.id }, _sum: { amount: true }, orderBy: { period: 'desc' }, take: 12 }),
    prisma.referredUser.count({ where: { studioId: influencer.id, status: 'active' } }),
  ])
  const history = scHistory.map((h) => ({ period: h.period, amount: Math.round((h._sum.amount ?? 0) * 100) / 100 }))
  const hasCommission = (scTotal._sum.amount ?? 0) !== 0 || referredActive > 0

  return (
    <>
      {hasCommission && (
        <div className="p-6 pb-0 lg:p-8 lg:pb-0">
          <GlassCard className="p-5">
            <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Studio commission (20% of every payment)</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'This month', value: usd(Math.round((scMonth._sum.amount ?? 0) * 100) / 100) },
                { label: 'Pending', value: usd(Math.round((scPending._sum.amount ?? 0) * 100) / 100) },
                { label: 'Total earned', value: usd(Math.round((scTotal._sum.amount ?? 0) * 100) / 100) },
                { label: 'Active referred users', value: String(referredActive) },
              ].map((m) => (
                <div key={m.label} className="rounded-[var(--radius-md)] p-3" style={{ background: 'var(--bg-2)' }}>
                  <p className="body-sm text-[var(--ink-3)]">{m.label}</p>
                  <p className="display-sm mt-0.5 text-[var(--ink-1)]">{m.value}</p>
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--line-1)' }}>
                <span className="body-sm text-[var(--ink-3)]">History:</span>
                {history.map((h) => (
                  <span key={h.period} className="body-sm rounded-full px-2 py-0.5" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                    {h.period}: {usd(h.amount)}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}
      <PartnerClient
        influencer={JSON.parse(JSON.stringify(influencer))}
        conversions={JSON.parse(JSON.stringify(conversions))}
        payouts={JSON.parse(JSON.stringify(payouts))}
        stats={stats}
        referralUrl={referralUrl}
      />
    </>
  )
}

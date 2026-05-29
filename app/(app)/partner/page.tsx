import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PartnerClient } from './partner-client'
import { GlassCard } from '@/components/common/GlassCard'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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

  return (
    <PartnerClient
      influencer={JSON.parse(JSON.stringify(influencer))}
      conversions={JSON.parse(JSON.stringify(conversions))}
      payouts={JSON.parse(JSON.stringify(payouts))}
      stats={stats}
      referralUrl={referralUrl}
    />
  )
}

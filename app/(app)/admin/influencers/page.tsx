import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { InfluencersAdminClient } from './influencers-client'
import { isAdmin } from '@/lib/admin'

export default async function InfluencersAdminPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!isAdmin(session.user.email)) redirect('/studio')

  const [influencers, conversions, payouts] = await Promise.all([
    prisma.influencer.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.influencerConversion.findMany({ orderBy: { conversionDate: 'desc' }, take: 100, include: { influencer: { select: { name: true } } } }),
    prisma.payoutLog.findMany({ orderBy: { payoutDate: 'desc' }, take: 50 }),
  ])

  return (
    <InfluencersAdminClient
      influencers={JSON.parse(JSON.stringify(influencers))}
      conversions={JSON.parse(JSON.stringify(conversions))}
      payouts={JSON.parse(JSON.stringify(payouts))}
    />
  )
}

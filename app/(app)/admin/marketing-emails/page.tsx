import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { MarketingEmailsClient } from './marketing-emails-client'

export const dynamic = 'force-dynamic'

export default async function MarketingEmailsAdminPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!isAdmin(session.user.email)) redirect('/studio')

  // Pull the live recipient counts for each audience tier so the admin can see
  // exactly how many people each option will reach before queuing a campaign.
  const baseWhere = { marketingEmailOptIn: true }
  const [campaigns, freeCount, soloCount, masterCount, allCount] = await Promise.all([
    prisma.marketingEmailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.count({ where: { ...baseWhere, plan: 'free' } }),
    prisma.user.count({ where: { ...baseWhere, plan: 'solo' } }),
    prisma.user.count({ where: { ...baseWhere, plan: 'master' } }),
    prisma.user.count({ where: baseWhere }),
  ])

  return (
    <MarketingEmailsClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      recipientCounts={{ FREE: freeCount, SOLO: soloCount, MASTER: masterCount, ALL: allCount }}
    />
  )
}

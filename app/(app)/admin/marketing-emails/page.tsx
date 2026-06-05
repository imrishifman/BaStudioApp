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

  const [campaigns, freeRecipientCount] = await Promise.all([
    prisma.marketingEmailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.count({ where: { plan: 'free', marketingEmailOptIn: true } }),
  ])

  return (
    <MarketingEmailsClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      freeRecipientCount={freeRecipientCount}
    />
  )
}

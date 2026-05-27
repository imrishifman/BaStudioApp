import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AdminClient } from './admin-client'
import { isAdmin } from '@/lib/admin'

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!isAdmin(session.user.email)) redirect('/studio')

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const [users, coupons, feedback, totalEpisodes, publishedEpisodes, briefsSent, socialGenerated, activeUsersThisWeek, onboardingComplete, neverActivated] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.couponCode.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.userFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.episode.count(),
    prisma.episode.count({ where: { status: 'published' } }),
    prisma.episode.count({ where: { briefSentAt: { not: null } } }),
    prisma.episode.count({ where: { socialContent: { not: { equals: null as never } } } }),
    prisma.episode.findMany({
      where: { updatedAt: { gte: oneWeekAgo } },
      select: { createdByEmail: true },
      distinct: ['createdByEmail'],
    }),
    prisma.user.count({ where: { onboardingComplete: true } }),
    prisma.user.count({ where: { onboardingComplete: false, createdAt: { lt: threeDaysAgo } } }),
  ])

  const stats = {
    totalUsers: users.length,
    soloUsers: users.filter((u) => u.plan === 'solo').length,
    masterUsers: users.filter((u) => u.plan === 'master').length,
    activeThisWeek: activeUsersThisWeek.length,
    totalEpisodes,
    publishedEpisodes,
    onboardingComplete,
    neverActivated,
    briefsSent,
    socialGenerated,
  }

  return (
    <AdminClient
      users={JSON.parse(JSON.stringify(users))}
      coupons={JSON.parse(JSON.stringify(coupons))}
      feedback={JSON.parse(JSON.stringify(feedback))}
      stats={stats}
    />
  )
}

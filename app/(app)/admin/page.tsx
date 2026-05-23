import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AdminClient } from './admin-client'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'imri@babalata.com'

export default async function AdminPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (session.user.email !== ADMIN_EMAIL) redirect('/studio')

  const [users, coupons, totalEpisodes] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.couponCode.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.episode.count(),
  ])

  const stats = {
    totalUsers: users.length,
    soloUsers: users.filter(u => u.plan === 'solo').length,
    masterUsers: users.filter(u => u.plan === 'master').length,
    totalEpisodes,
  }

  return (
    <AdminClient
      users={JSON.parse(JSON.stringify(users))}
      coupons={JSON.parse(JSON.stringify(coupons))}
      stats={stats}
    />
  )
}

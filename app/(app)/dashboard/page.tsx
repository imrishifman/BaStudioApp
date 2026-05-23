import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const episodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })

  return <DashboardClient episodes={JSON.parse(JSON.stringify(episodes))} sessionUser={session.user} />
}

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StudioClient } from './studio-client'

export default async function StudioPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const [episodes, shows, user, guestCount] = await Promise.all([
    prisma.episode.findMany({
      where: { createdByEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.show.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        fullName: true,
        plan: true,
        onboardingComplete: true,
        skippedDnaSetup: true,
        aiResearchCountThisMonth: true,
      },
    }),
    prisma.guest.count({ where: { ownerEmail: session.user.email } }),
  ])

  return (
    <StudioClient
      episodes={JSON.parse(JSON.stringify(episodes))}
      shows={JSON.parse(JSON.stringify(shows))}
      user={user}
      guestCount={guestCount}
      sessionUser={session.user}
    />
  )
}

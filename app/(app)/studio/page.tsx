import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StudioClient } from './studio-client'

export default async function StudioPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const [episodes, shows, user, guestCount, published] = await Promise.all([
    prisma.episode.findMany({
      where: { createdByEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.show.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
      include: { episodes: { select: { status: true } } },
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
    prisma.episode.findMany({
      where: {
        createdByEmail: session.user.email,
        status: 'published',
        publishedAt: { not: null },
      },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 60,
    }),
  ])

  const publishedDates = published
    .map((e) => e.publishedAt?.toISOString())
    .filter((d): d is string => !!d)

  return (
    <StudioClient
      episodes={JSON.parse(JSON.stringify(episodes))}
      shows={JSON.parse(JSON.stringify(shows))}
      user={user}
      guestCount={guestCount}
      publishedDates={publishedDates}
      sessionUser={session.user}
    />
  )
}

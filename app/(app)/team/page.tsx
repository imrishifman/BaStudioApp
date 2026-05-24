import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { TeamClient } from './team-client'

export default async function TeamPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!canAccess(session.user, 'master')) redirect('/pricing')

  const [shows, teams] = await Promise.all([
    prisma.show.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.team.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Last message per group (show) for the WhatsApp-style list preview.
  const lastMessages: Record<string, { message: string; createdAt: string } | null> = {}
  await Promise.all(
    shows.map(async (s) => {
      const m = await prisma.teamMessage.findFirst({
        where: { showId: s.id },
        orderBy: { createdAt: 'desc' },
      })
      lastMessages[s.id] = m
        ? { message: m.message, createdAt: m.createdAt.toISOString() }
        : null
    })
  )

  return (
    <TeamClient
      shows={JSON.parse(JSON.stringify(shows))}
      teams={JSON.parse(JSON.stringify(teams))}
      lastMessages={lastMessages}
      sessionUser={session.user}
    />
  )
}

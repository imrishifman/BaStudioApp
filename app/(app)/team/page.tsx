import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { TeamClient } from './team-client'

export default async function TeamPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!canAccess(session.user, 'master')) redirect('/pricing')

  const shows = await prisma.show.findMany({ where: { ownerEmail: session.user.email } })
  const firstShow = shows[0]

  const messages = firstShow
    ? await prisma.teamMessage.findMany({
        where: { showId: firstShow.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { sender: { select: { fullName: true, email: true, image: true } } },
      })
    : []

  return (
    <TeamClient
      shows={JSON.parse(JSON.stringify(shows))}
      initialMessages={JSON.parse(JSON.stringify(messages.reverse()))}
      sessionUser={session.user}
    />
  )
}

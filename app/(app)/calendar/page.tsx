import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!canAccess(session.user, 'solo')) redirect('/pricing')

  const episodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email, releaseDate: { not: null } },
    orderBy: { releaseDate: 'asc' },
    select: { id: true, title: true, guestName: true, releaseDate: true, status: true },
  })

  return <CalendarClient episodes={JSON.parse(JSON.stringify(episodes))} />
}

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { CalendarClient } from './calendar-client'

export default async function CalendarPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!canAccess(session.user, 'solo')) redirect('/pricing')

  const [episodes, availability, shows] = await Promise.all([
    prisma.episode.findMany({
      where: { createdByEmail: session.user.email },
      orderBy: { releaseDate: 'asc' },
      select: {
        id: true,
        title: true,
        guestName: true,
        guestPhotoUrl: true,
        releaseDate: true,
        status: true,
        show: { select: { name: true } },
      },
    }),
    prisma.availabilityBlock.findMany({
      where: { userEmail: session.user.email, showId: null },
      select: { date: true, status: true, note: true },
    }),
    prisma.show.findMany({
      where: { ownerEmail: session.user.email },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <CalendarClient
      episodes={JSON.parse(JSON.stringify(episodes))}
      availability={JSON.parse(JSON.stringify(availability))}
      shows={shows}
      userId={session.user.id}
    />
  )
}

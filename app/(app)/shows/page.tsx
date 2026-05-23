import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { ShowsClient } from './shows-client'

export default async function ShowsPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  if (!canAccess(session.user, 'solo')) redirect('/pricing')

  const shows = await prisma.show.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { episodes: true } } },
  })

  return <ShowsClient shows={JSON.parse(JSON.stringify(shows))} />
}

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { canAccess } from '@/lib/plan-gating'
import { GuestsClient } from './guests-client'

export default async function GuestsPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!canAccess(session.user, 'solo')) redirect('/pricing')

  const guests = await prisma.guest.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })

  return <GuestsClient guests={JSON.parse(JSON.stringify(guests))} />
}

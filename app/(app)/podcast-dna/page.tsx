import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PodcastDNAClient } from './podcast-dna-client'

export default async function PodcastDNAPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const shows = await prisma.show.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })

  const firstShow = shows[0] ?? null

  return (
    <PodcastDNAClient
      shows={JSON.parse(JSON.stringify(shows))}
      initialShow={firstShow ? JSON.parse(JSON.stringify(firstShow)) : null}
    />
  )
}

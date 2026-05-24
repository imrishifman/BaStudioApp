import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { EpisodeWizard } from '@/components/episode/EpisodeWizard'

export default async function EpisodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const episode = await prisma.episode.findFirst({
    where: {
      id,
      OR: [
        { createdByEmail: session.user.email },
        { sharedWith: { has: session.user.email } },
      ],
    },
  })

  if (!episode) notFound()

  const shows = await prisma.show.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <EpisodeWizard
      episode={JSON.parse(JSON.stringify(episode))}
      shows={JSON.parse(JSON.stringify(shows))}
      userEmail={session.user.email}
    />
  )
}

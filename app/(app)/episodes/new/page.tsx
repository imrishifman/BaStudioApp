import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EpisodeWizard } from '@/components/episode/EpisodeWizard'

export default async function NewEpisodePage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const shows = await prisma.show.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <EpisodeWizard
      episode={null}
      shows={JSON.parse(JSON.stringify(shows))}
      userEmail={session.user.email}
    />
  )
}

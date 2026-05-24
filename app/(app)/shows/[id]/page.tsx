import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { ShowDetailClient } from './show-detail-client'

export default async function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const show = await prisma.show.findFirst({
    where: { id, ownerEmail: session.user.email },
    include: {
      episodes: { orderBy: { updatedAt: 'desc' }, take: 20 },
    },
  })

  if (!show) notFound()

  return (
    <ShowDetailClient
      show={JSON.parse(JSON.stringify(show))}
      currentEmail={session.user.email}
    />
  )
}

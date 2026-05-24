import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { ShowDnaClient } from './dna-client'

export default async function ShowDnaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/?signin=1')

  const show = await prisma.show.findFirst({
    where: { id, ownerEmail: session.user.email },
  })
  if (!show) notFound()

  return <ShowDnaClient show={JSON.parse(JSON.stringify(show))} />
}

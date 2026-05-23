import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getEpisode(id: string, email: string) {
  return prisma.episode.findFirst({ where: { id, createdByEmail: email } })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ep = await getEpisode(id, session.user.email)
  if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(ep)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ep = await getEpisode(id, session.user.email)
  if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  // Strip non-updatable fields
  delete body.id; delete body.createdByEmail; delete body.createdAt

  const updated = await prisma.episode.update({ where: { id }, data: body })
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ep = await getEpisode(id, session.user.email)
  if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.episode.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

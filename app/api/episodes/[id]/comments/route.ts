import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function accessibleEpisode(id: string, email: string) {
  return prisma.episode.findFirst({
    where: { id, OR: [{ createdByEmail: email }, { sharedWith: { has: email } }] },
    select: { id: true },
  })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await accessibleEpisode(id, session.user.email)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const comments = await prisma.episodeComment.findMany({
    where: { episodeId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(comments)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await accessibleEpisode(id, session.user.email)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const comment = await prisma.episodeComment.create({
    data: {
      episodeId: id,
      message: message.trim(),
      authorEmail: session.user.email,
      authorName: session.user.name ?? null,
      type: 'general',
    },
  })
  return NextResponse.json(comment)
}

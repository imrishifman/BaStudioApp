import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureGuestFromEpisode } from '@/lib/guest-sync'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const episodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(episodes)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const episode = await prisma.episode.create({
    data: {
      ...body,
      createdByEmail: session.user.email,
      currentStep: 1,
      status: 'draft',
    },
  })

  // Every episode guest flows into the Guest CRM automatically.
  await ensureGuestFromEpisode(session.user.email, episode)

  return NextResponse.json(episode)
}

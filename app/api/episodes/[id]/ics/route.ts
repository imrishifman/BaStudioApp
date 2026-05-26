import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildIcs } from '@/lib/ics'

// Returns a downloadable .ics for a scheduled episode so the host (or a team
// member it's shared with) can add the recording to any calendar app.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const episode = await prisma.episode.findFirst({
    where: {
      id,
      OR: [{ createdByEmail: session.user.email }, { sharedWith: { has: session.user.email } }],
    },
    include: { show: { select: { name: true } } },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!episode.releaseDate) {
    return NextResponse.json({ error: 'Episode has no scheduled date' }, { status: 400 })
  }

  const ics = buildIcs({
    uid: `episode-${episode.id}@bastudio`,
    title: `${episode.show?.name ?? 'Episode'} - ${episode.title ?? episode.guestName}`,
    description: `Recording with ${episode.guestName}.`,
    start: new Date(episode.releaseDate),
    durationMinutes: 60,
    method: 'PUBLISH',
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${episode.id}.ics"`,
    },
  })
}

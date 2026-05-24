import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const teams = await prisma.team.findMany({
    where: { ownerEmail: session.user.email },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(teams)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, showId, memberEmails } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
  }

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      ownerEmail: session.user.email,
      showId: showId || null,
      memberEmails: Array.isArray(memberEmails)
        ? memberEmails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
        : [],
    },
  })

  // Grant the team access to the attached show's existing episodes.
  if (team.showId) {
    await prisma.episode.updateMany({
      where: { createdByEmail: session.user.email, showId: team.showId },
      data: { teamId: team.id, sharedWith: team.memberEmails },
    })
  }

  return NextResponse.json(team)
}

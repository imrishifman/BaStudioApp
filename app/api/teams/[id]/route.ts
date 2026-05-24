import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const team = await prisma.team.findFirst({ where: { id, ownerEmail: session.user.email } })
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, showId, memberEmails } = await req.json()
  const data: { name?: string; showId?: string | null; memberEmails?: string[] } = {}
  if (typeof name === 'string') data.name = name.trim()
  if (showId !== undefined) data.showId = showId || null
  if (Array.isArray(memberEmails)) {
    data.memberEmails = memberEmails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
  }

  const updated = await prisma.team.update({ where: { id }, data })

  // Keep the attached show's episodes in sync with the team's members.
  if (updated.showId) {
    await prisma.episode.updateMany({
      where: { createdByEmail: session.user.email, showId: updated.showId },
      data: { teamId: updated.id, sharedWith: updated.memberEmails },
    })
  }
  // If the show was detached, drop this team's sharing from its old episodes.
  if (team.showId && updated.showId !== team.showId) {
    await prisma.episode.updateMany({
      where: { createdByEmail: session.user.email, showId: team.showId, teamId: updated.id },
      data: { teamId: null, sharedWith: [] },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Revoke this team's sharing from its episodes before deleting it.
  await prisma.episode.updateMany({
    where: { createdByEmail: session.user.email, teamId: id },
    data: { teamId: null, sharedWith: [] },
  })
  await prisma.team.deleteMany({ where: { id, ownerEmail: session.user.email } })
  return NextResponse.json({ ok: true })
}

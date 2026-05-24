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
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.team.deleteMany({ where: { id, ownerEmail: session.user.email } })
  return NextResponse.json({ ok: true })
}

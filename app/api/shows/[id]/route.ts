import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const show = await prisma.show.findFirst({ where: { id, ownerEmail: session.user.email } })
  if (!show) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(show)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const show = await prisma.show.findFirst({ where: { id, ownerEmail: session.user.email } })
  if (!show) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  delete body.id; delete body.ownerEmail; delete body.createdAt
  const updated = await prisma.show.update({ where: { id }, data: body })
  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.show.deleteMany({ where: { id, ownerEmail: session.user.email } })
  return NextResponse.json({ ok: true })
}

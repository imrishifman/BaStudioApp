import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const guest = await prisma.guest.findFirst({ where: { id, ownerEmail: session.user.email } })
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.guest.update({
    where: { id },
    data: {
      ...(body.pipelineStatus !== undefined && { pipelineStatus: body.pipelineStatus }),
      ...(body.name !== undefined && { name: body.name }),
      ...(body.bio !== undefined && { bio: body.bio }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const guest = await prisma.guest.findFirst({ where: { id, ownerEmail: session.user.email } })
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.guest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const showId = searchParams.get('showId')
  if (!showId) return NextResponse.json([])

  const messages = await prisma.teamMessage.findMany({
    where: { showId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { sender: { select: { fullName: true, email: true } } },
  })
  return NextResponse.json(messages)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { showId, message } = await req.json()
  if (!showId || !message) return NextResponse.json({ error: 'showId and message required' }, { status: 400 })

  const msg = await prisma.teamMessage.create({
    data: { showId, message, senderEmail: session.user.email, senderName: session.user.name ?? null },
    include: { sender: { select: { fullName: true, email: true } } },
  })
  return NextResponse.json(msg)
}

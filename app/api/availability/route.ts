import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function toDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const blocks = await prisma.availabilityBlock.findMany({
    where: { userEmail: session.user.email },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(blocks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, status, note } = await req.json()
  if (!date || (status !== 'available' && status !== 'busy')) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const day = toDateOnly(date)
  const existing = await prisma.availabilityBlock.findFirst({
    where: { userEmail: session.user.email, date: day, showId: null },
  })

  const block = existing
    ? await prisma.availabilityBlock.update({
        where: { id: existing.id },
        data: { status, note: note ?? null },
      })
    : await prisma.availabilityBlock.create({
        data: {
          userId: session.user.id,
          userEmail: session.user.email,
          date: day,
          status,
          note: note ?? null,
        },
      })

  return NextResponse.json(block)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await req.json()
  if (!date) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  await prisma.availabilityBlock.deleteMany({
    where: { userEmail: session.user.email, date: toDateOnly(date), showId: null },
  })
  return NextResponse.json({ ok: true })
}

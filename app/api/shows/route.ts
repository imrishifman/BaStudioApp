import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const shows = await prisma.show.findMany({ where: { ownerEmail: session.user.email }, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json(shows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const show = await prisma.show.create({ data: { ...body, ownerEmail: session.user.email } })
  return NextResponse.json(show)
}

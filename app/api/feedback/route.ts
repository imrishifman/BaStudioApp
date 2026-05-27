import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

const VALID_TYPES = new Set(['praise', 'review', 'suggestion', 'complaint'])

export async function POST(req: Request) {
  // Allow logged-out users to submit too (e.g. from a public landing review CTA).
  const session = await auth()
  const userEmail = session?.user?.email ?? null
  const userName = session?.user?.name ?? null

  const body = await req.json()
  const message = String(body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const type = String(body.type ?? '').toLowerCase()
  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const rating = typeof body.rating === 'number' ? Math.min(5, Math.max(1, Math.round(body.rating))) : null
  const page = body.page ? String(body.page).slice(0, 200) : null
  const question = body.question ? String(body.question).slice(0, 200) : null

  const fb = await prisma.userFeedback.create({
    data: {
      userEmail,
      userName,
      type: type || null,
      message: message.slice(0, 4000),
      page,
      question,
      rating,
      source: 'review-page',
    },
  })

  return NextResponse.json({ ok: true, id: fb.id })
}

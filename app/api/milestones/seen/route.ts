import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isMilestoneKey } from '@/lib/milestones'

export const maxDuration = 15

// Records that the current user has been shown a first-time milestone review
// prompt, so the floating chat bubble fires at most once per milestone per
// account. Idempotent: re-recording an already-seen key is a no-op.
export async function POST(req: Request) {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const key = body?.key
  if (!isMilestoneKey(key)) {
    return NextResponse.json({ error: 'Invalid milestone key' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { reviewedMilestones: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!user.reviewedMilestones.includes(key)) {
    await prisma.user.update({
      where: { email: userEmail },
      data: { reviewedMilestones: { set: [...user.reviewedMilestones, key] } },
    })
  }

  return NextResponse.json({ ok: true })
}

// Send the weekly approval digest for whatever is currently awaiting approval.
// Assigns a publish day (scheduledFor) to any pending post that doesn't have
// one yet, then emails Imri a single "Approve all / per-post" digest. Admin
// (manual) or cron (Bearer CRON_SECRET). Use this to (re)queue posts that were
// created before the weekly flow, without generating new ones.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { sendWeeklyApprovalEmail, type WeeklyApprovalPost } from '@/lib/email/social-approval'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  const session = await auth()
  return isAdmin(session?.user?.email)
}

async function handle(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Everything still awaiting approval, scheduled ones first then unscheduled.
  const pending = await prisma.socialPost.findMany({
    where: { status: 'pending_approval' },
    orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
    take: 14,
  })
  if (pending.length === 0) {
    return NextResponse.json({ pending: 0, emailed: false })
  }

  // Give any post without a publish day a slot, starting tomorrow at 00:00 UTC
  // (the daily 17:00 UTC = 1 PM NY publish cron releases each on its day).
  const midnightUtc = new Date()
  midnightUtc.setUTCHours(0, 0, 0, 0)
  let assigned = 0

  const list: WeeklyApprovalPost[] = []
  for (const p of pending) {
    let scheduledFor = p.scheduledFor
    if (!scheduledFor) {
      scheduledFor = new Date(midnightUtc.getTime() + (assigned + 1) * 86_400_000)
      await prisma.socialPost.update({ where: { id: p.id }, data: { scheduledFor } })
      assigned++
    }
    list.push({
      id: p.id,
      caption: p.caption,
      hashtags: p.hashtags,
      imageUrl: p.imageUrl,
      scheduledFor,
    })
  }

  const emailed = await sendWeeklyApprovalEmail(list)
  return NextResponse.json({ pending: list.length, scheduled: assigned, emailed })
}

export async function POST(req: Request) {
  return handle(req)
}
export async function GET(req: Request) {
  return handle(req)
}

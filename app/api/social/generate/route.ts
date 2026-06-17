// Generate posts: Claude writes specs -> render to PNG -> upload to Blob ->
// store as pending_approval -> email Imri an approval link. Admin or cron.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { generatePostSpecs } from '@/lib/social/generate'
import { renderPost } from '@/lib/social/render'
import { uploadPostImage } from '@/lib/social/blob'
import { sendWeeklyApprovalEmail, type WeeklyApprovalPost } from '@/lib/email/social-approval'

export const runtime = 'nodejs'
export const maxDuration = 300
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
  let count = 7 // a full week, one post per day
  try {
    const body = (await req.json()) as { count?: number }
    if (typeof body.count === 'number') count = body.count
  } catch {
    /* GET / empty body -> default */
  }
  count = Math.min(Math.max(count, 1), 7)

  const recent = await prisma.socialPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { caption: true },
  })
  const avoid = recent.map((r) => r.caption.split('\n')[0]).slice(0, 20)

  const specs = await generatePostSpecs(count, avoid)

  // Schedule one post per day, starting tomorrow, at 00:00 UTC. The daily
  // publish cron (17:00 UTC = 1 PM NY) releases each one on its day.
  const midnightUtc = new Date()
  midnightUtc.setUTCHours(0, 0, 0, 0)

  const created: WeeklyApprovalPost[] = []
  const results: Array<Record<string, unknown>> = []
  let dayOffset = 0
  for (const spec of specs) {
    try {
      const png = await renderPost(spec)
      const imageUrl = await uploadPostImage(png, spec.headline)
      const scheduledFor = new Date(midnightUtc.getTime() + (dayOffset + 1) * 86_400_000)
      const post = await prisma.socialPost.create({
        data: {
          status: 'pending_approval',
          caption: spec.caption,
          hashtags: spec.hashtags,
          imageUrl,
          scheduledFor,
        },
      })
      created.push({
        id: post.id,
        caption: post.caption,
        hashtags: post.hashtags,
        imageUrl,
        headline: spec.headline,
        scheduledFor,
      })
      results.push({ id: post.id, headline: spec.headline, imageUrl, scheduledFor })
      dayOffset++
    } catch (e) {
      results.push({
        headline: spec.headline,
        error: e instanceof Error ? e.message : 'failed',
      })
    }
  }

  // One digest email for the whole week instead of one email per post.
  const emailed = created.length > 0 ? await sendWeeklyApprovalEmail(created) : false
  return NextResponse.json({ generated: created.length, emailed, results })
}

export async function POST(req: Request) {
  return handle(req)
}
export async function GET(req: Request) {
  return handle(req)
}

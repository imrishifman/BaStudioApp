// Publish APPROVED social posts to Instagram (and later cross-post to FB).
// Callable by an admin (manual) or by the cron (Bearer CRON_SECRET).
// The approval gate is enforced here: a post that is not 'approved' is skipped.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { publishImage } from '@/lib/social/instagram'
import { crossPostToFacebook } from '@/lib/social/facebook'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  const session = await auth()
  return isAdmin(session?.user?.email)
}

// GET (cron, Bearer CRON_SECRET) publishes all approved posts that are due.
export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { postId?: string }

  const where: Prisma.SocialPostWhereInput = body.postId
    ? { id: body.postId }
    : {
        status: 'approved',
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      }
  // 25 publishes / 24h is the IG cap; we stay well under per run.
  const posts = await prisma.socialPost.findMany({ where, take: body.postId ? 1 : 10 })

  const results: Array<Record<string, unknown>> = []
  for (const post of posts) {
    if (post.status !== 'approved') {
      results.push({ id: post.id, skipped: `status is ${post.status}, not approved` })
      continue
    }
    if (!post.imageUrl) {
      results.push({ id: post.id, error: 'no imageUrl' })
      continue
    }
    await prisma.socialPost.update({ where: { id: post.id }, data: { status: 'publishing' } })
    try {
      const { mediaId, permalink } = await publishImage({
        imageUrl: post.imageUrl,
        caption: post.caption,
        hashtags: post.hashtags ?? undefined,
      })
      // Cross-post to the Facebook Page (no-op unless FB env is configured).
      const fbPostId = await crossPostToFacebook(
        post.imageUrl,
        post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption,
      )
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: 'published',
          igMediaId: mediaId,
          permalink,
          fbPostId,
          publishedAt: new Date(),
          error: null,
        },
      })
      results.push({ id: post.id, published: true, permalink, fbPostId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'publish failed'
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'failed', error: msg },
      })
      results.push({ id: post.id, error: msg })
    }
  }
  return NextResponse.json({ count: results.length, results })
}

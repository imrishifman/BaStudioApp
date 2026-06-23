// Admin-only: re-render an existing SocialPost's image from a supplied spec and
// swap in the new image, without changing its caption, schedule, or status.
// Used to apply a renderer fix to specific already-generated posts in place
// (the original spec isn't stored, so it's passed in the request body).
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { renderPost } from '@/lib/social/render'
import { uploadPostImage } from '@/lib/social/blob'
import type { PostSpec } from '@/lib/social/types'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { postId?: string; spec?: PostSpec }
  if (!body.postId || !body.spec?.headline || !body.spec?.diagram?.type) {
    return NextResponse.json({ error: 'postId and a full spec are required' }, { status: 400 })
  }
  const post = await prisma.socialPost.findUnique({ where: { id: body.postId } })
  if (!post) return NextResponse.json({ error: 'post not found' }, { status: 404 })
  if (post.status === 'published' || post.status === 'publishing') {
    return NextResponse.json({ error: `post is ${post.status}, not re-rendering` }, { status: 409 })
  }
  try {
    const png = await renderPost(body.spec)
    const imageUrl = await uploadPostImage(png, body.spec.headline)
    await prisma.socialPost.update({ where: { id: post.id }, data: { imageUrl } })
    return NextResponse.json({ ok: true, id: post.id, imageUrl })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'render failed' }, { status: 500 })
  }
}

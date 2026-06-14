// One-click approve/reject from the email. Signed token, no login. Approving
// flips the post to 'approved' (the publish cron then posts it).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyApproval } from '@/lib/social/approval'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function page(title: string, body: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,Arial;background:#0E1117;color:#F6F3EE;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px;padding:24px"><h1 style="color:#FF5C3C;font-size:24px">${title}</h1><p style="color:#8A93A3;font-size:15px;line-height:1.5">${body}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  const v = token ? verifyApproval(token) : null
  if (!v) return page('Invalid link', 'This approval link is invalid or has been tampered with.')

  const post = await prisma.socialPost.findUnique({ where: { id: v.postId } })
  if (!post) return page('Not found', 'That post no longer exists.')
  if (post.status === 'published' || post.status === 'publishing') {
    return page('Already published', 'This post has already gone out.')
  }

  await prisma.socialPost.update({
    where: { id: v.postId },
    data:
      v.action === 'approve'
        ? { status: 'approved', approvedAt: new Date() }
        : { status: 'rejected' },
  })

  return v.action === 'approve'
    ? page('Approved', 'This post is queued and will publish to Instagram shortly.')
    : page('Rejected', 'Got it. This post will not be published.')
}

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

  // One token can carry a single post id or a whole week (comma-joined).
  const ids = v.postId.split(',').filter(Boolean)
  const posts = await prisma.socialPost.findMany({ where: { id: { in: ids } } })
  if (posts.length === 0) return page('Not found', 'Those posts no longer exist.')

  let changed = 0
  let alreadyOut = 0
  for (const post of posts) {
    if (post.status === 'published' || post.status === 'publishing') {
      alreadyOut++
      continue
    }
    await prisma.socialPost.update({
      where: { id: post.id },
      data:
        v.action === 'approve'
          ? { status: 'approved', approvedAt: new Date() }
          : { status: 'rejected' },
    })
    changed++
  }

  const single = ids.length === 1
  if (v.action === 'approve') {
    if (changed === 0) return page('Already published', 'These posts have already gone out.')
    const body = single
      ? 'This post is queued and will publish at its scheduled day, 1 PM New York.'
      : `${changed} post${changed === 1 ? '' : 's'} approved. They publish one per day at 1 PM New York.${alreadyOut ? ` (${alreadyOut} already out.)` : ''}`
    return page('Approved', body)
  }
  if (changed === 0) return page('Already published', 'These posts have already gone out.')
  return page('Rejected', single ? 'Got it. This post will not be published.' : `${changed} post${changed === 1 ? '' : 's'} rejected. They will not be published.`)
}

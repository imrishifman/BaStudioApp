// Admin-only: create, list, and approve/reject social posts.
// Approval is the gate: only posts moved to 'approved' here can ever publish.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await auth()
  return isAdmin(session?.user?.email)
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const posts = await prisma.socialPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ posts })
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    caption?: string
    hashtags?: string
    imageUrl?: string
    status?: string
    scheduledFor?: string
  }
  if (typeof body.caption !== 'string' || !body.caption.trim()) {
    return NextResponse.json({ error: 'caption required' }, { status: 400 })
  }
  if (/—|–/.test(body.caption)) {
    return NextResponse.json(
      { error: 'caption contains an em/en dash; rewrite it first' },
      { status: 400 },
    )
  }
  const data: Prisma.SocialPostCreateInput = {
    caption: body.caption,
    hashtags: body.hashtags ?? null,
    imageUrl: body.imageUrl ?? null,
    status: body.status === 'pending_approval' ? 'pending_approval' : 'draft',
    scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
  }
  const post = await prisma.socialPost.create({ data })
  return NextResponse.json({ post })
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    action?: string
  }
  if (!body.id || (body.action !== 'approve' && body.action !== 'reject')) {
    return NextResponse.json(
      { error: 'id and action (approve|reject) required' },
      { status: 400 },
    )
  }
  const post = await prisma.socialPost.update({
    where: { id: body.id },
    data:
      body.action === 'approve'
        ? { status: 'approved', approvedAt: new Date() }
        : { status: 'rejected' },
  })
  return NextResponse.json({ post })
}

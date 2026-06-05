import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  preheader: z.string().trim().max(200).optional().nullable(),
  html: z.string().trim().min(1).optional(),
  audience: z.enum(['FREE', 'SOLO', 'MASTER', 'ALL']).optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  if (!isAdmin(session.user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const
  }
  return { session } as const
}

// Update a DRAFT campaign in place. SENT campaigns are immutable.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if ('error' in a) return a.error
  const { id } = await ctx.params

  const existing = await prisma.marketingEmailCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Sent campaigns cannot be edited' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const updated = await prisma.marketingEmailCampaign.update({
    where: { id },
    data: {
      subject: parsed.data.subject ?? existing.subject,
      preheader: parsed.data.preheader === undefined ? existing.preheader : parsed.data.preheader,
      html: parsed.data.html ?? existing.html,
      audience: parsed.data.audience ?? existing.audience,
    },
  })
  return NextResponse.json({ campaign: updated })
}

// Delete a DRAFT campaign. SENT campaigns are kept for audit.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin()
  if ('error' in a) return a.error
  const { id } = await ctx.params

  const existing = await prisma.marketingEmailCampaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Sent campaigns cannot be deleted' }, { status: 409 })
  }
  await prisma.marketingEmailCampaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

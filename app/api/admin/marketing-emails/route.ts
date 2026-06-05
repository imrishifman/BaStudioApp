import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().trim().max(200).optional(),
  html: z.string().trim().min(1),
})

async function requireAdmin() {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const
  if (!isAdmin(session.user.email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const
  }
  return { session } as const
}

// List campaigns (newest first) for the admin page.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const campaigns = await prisma.marketingEmailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ campaigns })
}

// Queue a new campaign in DRAFT state. The next cron run will pick it up.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const created = await prisma.marketingEmailCampaign.create({
    data: {
      subject: parsed.data.subject,
      preheader: parsed.data.preheader || null,
      html: parsed.data.html,
      createdByEmail: auth.session.user.email,
    },
  })
  return NextResponse.json({ campaign: created })
}

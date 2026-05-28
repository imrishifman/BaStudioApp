import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

// Editable fields. Tightened to a small allowlist so a malformed PATCH body
// can't, say, flip agreementSigned or stripeAccountId from the admin UI.
const ALLOWED_FIELDS = new Set([
  'name', 'email', 'handle', 'couponCode', 'platform', 'followersCount',
  'commissionType', 'commissionValue', 'planAccess', 'status', 'notes',
  'couponActive',
])

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const data: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue
    data[key] = body[key]
  }
  if (typeof data.couponCode === 'string') {
    data.couponCode = data.couponCode.toUpperCase().trim() || null
  }
  if (typeof data.email === 'string') {
    data.email = data.email.toLowerCase().trim()
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  try {
    const updated = await prisma.influencer.update({ where: { id }, data: data as Prisma.InfluencerUpdateInput })
    return NextResponse.json(updated)
  } catch (err) {
    // Unique constraint violation on email or couponCode is the common case.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field'
      return NextResponse.json({ error: `${target} already in use` }, { status: 409 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }
    console.error('Influencer PATCH error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Hard delete cascades to ReferralClick + ReferralAttribution via FK onDelete:Cascade.
  // Conversions + payouts have no cascade rule, so we delete them explicitly to keep
  // the database referentially consistent. This is destructive and rare - admin
  // confirms in the UI before calling.
  try {
    await prisma.$transaction([
      prisma.influencerConversion.deleteMany({ where: { influencerId: id } }),
      prisma.payoutLog.deleteMany({ where: { influencerId: id } }),
      prisma.influencer.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }
    console.error('Influencer DELETE error:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

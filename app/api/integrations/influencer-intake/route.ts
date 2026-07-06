import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createInfluencer, generateUniqueCouponCode, referralLinkFor } from '@/lib/influencers/create'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Server-to-server intake for the Cold Call Manager (calls.bastudiopodcast.com).
// When a caller enrolls a lead, this creates the influencer ("studio") with the
// SAME shared creation logic as the admin "Add influencer" form.
//
// Auth: x-intake-secret header must equal INTAKE_SHARED_SECRET (timing-safe).
// Fixed defaults by design: 20% commission, NO customer discount (the code is
// referral-attribution only; the customer pays full price), status active.
// Idempotent by email: an existing influencer is returned, never duplicated.

function secretsMatch(provided: string | null): boolean {
  // Trim both sides: pasting into the Vercel env UI (or a curl header) easily
  // picks up a trailing newline/space, which must not break a byte comparison.
  const expected = process.env.INTAKE_SHARED_SECRET?.trim()
  const given = provided?.trim()
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// 401 diagnostic that never leaks the secret: distinguishes "the server has no
// secret configured" from "the provided secret does not match", so env-var
// setup problems are debuggable from the response alone.
function unauthorizedReason(): string {
  return process.env.INTAKE_SHARED_SECRET?.trim() ? 'secret-mismatch' : 'server-secret-not-configured'
}

function shape(inf: { id: string; name: string; email: string | null; couponCode: string | null; status: string }) {
  return {
    id: inf.id,
    name: inf.name,
    email: inf.email,
    couponCode: inf.couponCode,
    referralLink: inf.couponCode ? referralLinkFor(inf.couponCode) : null,
    status: inf.status,
  }
}

export async function POST(req: Request) {
  if (!secretsMatch(req.headers.get('x-intake-secret'))) {
    return NextResponse.json({ error: 'Unauthorized', reason: unauthorizedReason() }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid name and email are required' }, { status: 400 })
  }

  try {
    // Idempotent by email - return the existing influencer untouched.
    const existing = await prisma.influencer.findFirst({ where: { email } })
    if (existing) return NextResponse.json(shape(existing))

    const couponCode = await generateUniqueCouponCode(name)
    const { influencer } = await createInfluencer({
      name,
      email,
      handle: null,
      couponCode,
      commissionValue: 20,
      customerDiscount: null, // attribution-only code: no Stripe coupon, full price
      status: 'active',
      couponActive: true,
    })
    return NextResponse.json(shape(influencer))
  } catch (err) {
    console.error('[influencer-intake] error:', err)
    return NextResponse.json({ error: 'Intake failed' }, { status: 500 })
  }
}

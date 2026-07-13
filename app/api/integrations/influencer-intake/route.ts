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

function shape(
  inf: { id: string; name: string; email: string | null; couponCode: string | null; status: string; callerId: string | null },
  caller: { id: string; name: string } | null,
) {
  return {
    id: inf.id,
    name: inf.name,
    email: inf.email,
    couponCode: inf.couponCode,
    referralLink: inf.couponCode ? referralLinkFor(inf.couponCode) : null,
    status: inf.status,
    callerId: inf.callerId,
    caller: caller ? { id: caller.id, name: caller.name } : null,
  }
}

// Resolve the enrolling caller from the intake body. The Cold Call Manager (a
// trusted server holding the shared secret) asserts WHICH of its logged-in
// callers enrolled the lead, by email. We find-or-create the Caller so the
// studio is attributed automatically - no manual admin assignment needed.
async function resolveCaller(body: { callerEmail?: unknown; callerName?: unknown }): Promise<{ id: string; name: string } | null> {
  const callerEmail = typeof body?.callerEmail === 'string' ? body.callerEmail.trim().toLowerCase() : ''
  if (!callerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(callerEmail)) return null
  const callerName = typeof body?.callerName === 'string' && body.callerName.trim() ? body.callerName.trim() : callerEmail
  const caller = await prisma.caller.upsert({
    where: { email: callerEmail },
    update: {}, // never rename/overwrite an existing caller from intake
    create: { email: callerEmail, name: callerName, status: 'active' },
    select: { id: true, name: true },
  })
  return caller
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
    const caller = await resolveCaller(body)

    // Idempotent by email. If the studio already exists but has no caller yet,
    // back-fill the attribution now (a studio's caller is set once and never
    // reassigned); otherwise return it untouched.
    const existing = await prisma.influencer.findFirst({ where: { email } })
    if (existing) {
      if (!existing.callerId && caller) {
        const updated = await prisma.influencer.update({ where: { id: existing.id }, data: { callerId: caller.id } })
        return NextResponse.json(shape(updated, caller))
      }
      const owner = existing.callerId ? await prisma.caller.findUnique({ where: { id: existing.callerId }, select: { id: true, name: true } }) : null
      return NextResponse.json(shape(existing, owner))
    }

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
      callerId: caller?.id ?? null, // auto-attach the studio under its caller
    })
    return NextResponse.json(shape(influencer, caller))
  } catch (err) {
    console.error('[influencer-intake] error:', err)
    return NextResponse.json({ error: 'Intake failed' }, { status: 500 })
  }
}

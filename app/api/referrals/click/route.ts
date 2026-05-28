import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { findInfluencerByRefCode, hashIp } from '@/lib/referrals'

export const maxDuration = 10
export const runtime = 'nodejs'

// Called by the page after middleware has set bas_ref + bas_vid cookies.
// Validates the ref code, finds the matching Influencer (status=active), and
// writes a ReferralClick row. Silently no-ops on bad/missing codes so we
// never leak which codes exist.
//
// Anti-abuse: same visitorId is rate-limited to 1 click per influencer per
// hour. This prevents a single browser from inflating click counts.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const landingPath = String(body?.landingPath ?? '/').slice(0, 500)

    const ck = await cookies()
    const refCode = ck.get('bas_ref')?.value
    const visitorId = ck.get('bas_vid')?.value
    if (!refCode || !visitorId) return NextResponse.json({ ok: true, attributed: false })

    const influencer = await findInfluencerByRefCode(refCode)
    if (!influencer) return NextResponse.json({ ok: true, attributed: false })

    // Rate-limit: 1 click per (influencer, visitor) per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const existing = await prisma.referralClick.findFirst({
      where: {
        influencerId: influencer.id,
        visitorId,
        createdAt: { gte: oneHourAgo },
      },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ ok: true, attributed: true, deduped: true })

    const hdrs = await headers()
    const ua = hdrs.get('user-agent') ?? null
    const referrer = hdrs.get('referer') ?? null
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    await prisma.referralClick.create({
      data: {
        influencerId: influencer.id,
        visitorId,
        landingPath,
        userAgent: ua,
        referrer,
        ipHash: hashIp(ip),
      },
    })

    return NextResponse.json({ ok: true, attributed: true })
  } catch (err) {
    console.error('Referral click logging error:', err)
    // Never block the page on a tracking failure.
    return NextResponse.json({ ok: true, attributed: false })
  }
}

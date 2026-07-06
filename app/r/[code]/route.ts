import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findInfluencerByRefCode, hashIp } from '@/lib/referrals'

export const runtime = 'nodejs'
export const maxDuration = 10
export const dynamic = 'force-dynamic'

const REF_COOKIE = 'bas_ref'
const VID_COOKIE = 'bas_vid'
const THIRTY_DAYS = 60 * 60 * 24 * 30

function generateVisitorId() {
  const t = Date.now().toString(36)
  return `${t}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

// Shareable path-style referral link: /r/CODE. Resolves the code, records the
// ReferralClick SERVER-SIDE (so tracking never depends on client JS), sets the
// same first-touch attribution cookies as the middleware, and sends the
// visitor to the homepage signup funnel. Unknown codes still redirect (no code
// enumeration) - they just don't attribute.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const clean = decodeURIComponent(code ?? '').trim().slice(0, 64).toUpperCase()

  const res = NextResponse.redirect(new URL(`/?ref=${encodeURIComponent(clean)}`, req.url), 307)
  if (!clean) return NextResponse.redirect(new URL('/', req.url), 307)

  const secure = process.env.NODE_ENV === 'production'
  const existingRef = req.cookies.get(REF_COOKIE)?.value
  const visitorId = req.cookies.get(VID_COOKIE)?.value ?? generateVisitorId()

  // First-touch wins, mirroring proxy.ts. bas_ref is intentionally NOT
  // httpOnly: it is a marketing code, and the client ReferralTracker needs to
  // see it to fire click logging on later ?ref= visits.
  if (!existingRef) {
    res.cookies.set(REF_COOKIE, clean, { httpOnly: false, secure, sameSite: 'lax', maxAge: THIRTY_DAYS, path: '/' })
  }
  if (!req.cookies.get(VID_COOKIE)?.value) {
    res.cookies.set(VID_COOKIE, visitorId, { httpOnly: true, secure, sameSite: 'lax', maxAge: THIRTY_DAYS, path: '/' })
  }

  // Server-side click record (same validation + 1/hour/visitor rate limit as
  // /api/referrals/click). Best-effort: tracking never blocks the redirect.
  try {
    const influencer = await findInfluencerByRefCode(clean)
    if (influencer) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recent = await prisma.referralClick.findFirst({
        where: { influencerId: influencer.id, visitorId, createdAt: { gte: oneHourAgo } },
        select: { id: true },
      })
      if (!recent) {
        await prisma.referralClick.create({
          data: {
            influencerId: influencer.id,
            visitorId,
            landingPath: `/r/${clean}`,
            userAgent: req.headers.get('user-agent'),
            referrer: req.headers.get('referer'),
            ipHash: hashIp(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()),
          },
        })
      }
    }
  } catch (err) {
    console.error('[referral-route] click logging failed:', err)
  }

  return res
}

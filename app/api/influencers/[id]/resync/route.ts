import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { ensureStripePromo, isStripeLiveMode } from '@/lib/stripe-coupons'

export const runtime = 'nodejs'

// Admin: re-mint an influencer's Stripe promo in the CURRENT Stripe mode.
// The code is only redeemable (active) once the influencer has signed — this
// reconciles that too, so a code that was left inactive (e.g. the activate-on-
// sign step silently failed) gets switched on.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const inf = await prisma.influencer.findUnique({ where: { id } })
  if (!inf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!inf.couponCode || !inf.customerDiscount) {
    return NextResponse.json(
      { error: 'Influencer needs both a coupon code and a customer discount % to sync.' },
      { status: 400 },
    )
  }

  try {
    const result = await ensureStripePromo({
      code: inf.couponCode,
      percentOff: inf.customerDiscount,
      active: inf.agreementSigned, // only redeemable once they've signed
      stripeCouponId: inf.stripeCouponId,
      stripePromotionCodeId: inf.stripePromotionCodeId,
    })
    const updated = await prisma.influencer.update({
      where: { id },
      data: {
        stripeCouponId: result.stripeCouponId,
        stripePromotionCodeId: result.stripePromotionCodeId,
      },
    })
    return NextResponse.json({
      ...updated,
      recreated: result.recreated,
      active: inf.agreementSigned,
      liveMode: isStripeLiveMode(),
    })
  } catch (err) {
    console.error('[influencer-coupon] resync failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Re-sync failed' },
      { status: 502 },
    )
  }
}

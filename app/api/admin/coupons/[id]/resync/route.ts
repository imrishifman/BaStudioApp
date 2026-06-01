import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { ensureStripePromo, isStripeLiveMode } from '@/lib/stripe-coupons'

export const runtime = 'nodejs'

// Admin: re-mint this coupon's Stripe promo in the CURRENT Stripe mode.
// Fixes codes whose stored Stripe objects live in a different mode (e.g.
// created from localhost/test, then redeemed on live production).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const coupon = await prisma.couponCode.findUnique({ where: { id } })
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const result = await ensureStripePromo({
      code: coupon.code,
      percentOff: coupon.discountValue,
      active: true,
      maxRedemptions: coupon.maxUses > 0 ? coupon.maxUses : undefined,
      stripeCouponId: coupon.stripeCouponId,
      stripePromotionCodeId: coupon.stripePromotionCodeId,
    })
    const updated = await prisma.couponCode.update({
      where: { id },
      data: {
        stripeCouponId: result.stripeCouponId,
        stripePromotionCodeId: result.stripePromotionCodeId,
      },
    })
    return NextResponse.json({
      ...updated,
      recreated: result.recreated,
      liveMode: isStripeLiveMode(),
    })
  } catch (err) {
    console.error('[admin-coupon] resync failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Re-sync failed' },
      { status: 502 },
    )
  }
}

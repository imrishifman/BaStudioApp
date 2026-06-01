import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { createStripePromo, deleteStripePromo } from '@/lib/stripe-coupons'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, applicablePlan, discountValue, maxUses } = await req.json()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const normalizedCode = String(code).toUpperCase().trim()
  const percent = Math.min(100, Math.max(1, Number(discountValue) || 100))
  const max = Math.max(0, Number(maxUses) || 0)

  // Create a REAL Stripe Coupon + Promotion Code so the code typed on the
  // Stripe Checkout promo field actually discounts the price. Best-effort:
  // if Stripe isn't configured we still create the local row (so the in-app
  // /api/coupon redeem path keeps working), but flag that Stripe sync failed.
  let stripeCouponId: string | null = null
  let stripePromotionCodeId: string | null = null
  let stripeWarning: string | null = null

  try {
    const promo = await createStripePromo({
      code: normalizedCode,
      percentOff: percent,
      maxRedemptions: max,
      active: true,
    })
    stripeCouponId = promo.stripeCouponId
    stripePromotionCodeId = promo.stripePromotionCodeId
  } catch (err) {
    stripeWarning =
      err instanceof Error ? err.message : 'Stripe sync failed; code works in-app only.'
    console.error('[admin-coupon] Stripe sync failed:', err)
  }

  try {
    const coupon = await prisma.couponCode.create({
      data: {
        code: normalizedCode,
        discountType: 'percentage',
        discountValue: percent,
        applicablePlan: applicablePlan ?? null,
        maxUses: max,
        createdByEmail: session.user.email,
        stripeCouponId,
        stripePromotionCodeId,
      },
    })
    return NextResponse.json({ ...coupon, stripeWarning })
  } catch (err) {
    // Roll back the Stripe objects if the local write failed (e.g. dup code).
    await deleteStripePromo({ stripeCouponId, stripePromotionCodeId })
    const message =
      typeof err === 'object' && err && 'code' in err && (err as { code?: string }).code === 'P2002'
        ? 'A coupon with that code already exists.'
        : 'Could not create coupon.'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}

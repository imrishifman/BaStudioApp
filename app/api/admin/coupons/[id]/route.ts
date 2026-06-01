import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const coupon = await prisma.couponCode.findUnique({ where: { id } })
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Tear down the Stripe objects so the code stops working at checkout.
  // Deactivating the promotion code prevents new redemptions; deleting the
  // coupon removes the underlying discount. Both best-effort.
  if (coupon.stripePromotionCodeId) {
    await stripe.promotionCodes
      .update(coupon.stripePromotionCodeId, { active: false })
      .catch((err) => console.error('[admin-coupon] promo deactivate failed:', err))
  }
  if (coupon.stripeCouponId) {
    await stripe.coupons
      .del(coupon.stripeCouponId)
      .catch((err) => console.error('[admin-coupon] coupon delete failed:', err))
  }

  await prisma.couponCode.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

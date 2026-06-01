import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export interface StripePromoResult {
  stripeCouponId: string
  stripePromotionCodeId: string
}

/**
 * Creates a real Stripe Coupon + Promotion Code so a human-readable code typed
 * in the Stripe Checkout promo field actually discounts the price.
 *
 * Used by both admin coupons and influencer codes. `active: false` lets us
 * create the code now but keep it un-redeemable until a gating event (e.g. an
 * influencer signing their agreement), at which point we flip it active.
 *
 * Throws if Stripe is not configured or the API call fails — callers decide
 * whether to treat that as fatal or best-effort.
 */
export async function createStripePromo(opts: {
  code: string
  percentOff: number
  maxRedemptions?: number
  active?: boolean
}): Promise<StripePromoResult> {
  ensureStripeConfigured()
  const percent = Math.min(100, Math.max(1, Number(opts.percentOff) || 0))
  const code = opts.code.toUpperCase().trim()

  const coupon = await stripe.coupons.create({
    percent_off: percent,
    duration: 'forever',
    name: `${code} (${percent}% off)`,
  })
  const promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code,
    active: opts.active ?? true,
    ...(opts.maxRedemptions && opts.maxRedemptions > 0
      ? { max_redemptions: opts.maxRedemptions }
      : {}),
  })
  return { stripeCouponId: coupon.id, stripePromotionCodeId: promo.id }
}

/** Flip an existing promotion code active/inactive. Best-effort. */
export async function setStripePromoActive(promotionCodeId: string, active: boolean) {
  return stripe.promotionCodes.update(promotionCodeId, { active })
}

/** Tear down a coupon's Stripe objects. Best-effort; swallows errors. */
export async function deleteStripePromo(opts: {
  stripeCouponId?: string | null
  stripePromotionCodeId?: string | null
}) {
  if (opts.stripePromotionCodeId) {
    await stripe.promotionCodes
      .update(opts.stripePromotionCodeId, { active: false })
      .catch((err) => console.error('[stripe-coupons] promo deactivate failed:', err))
  }
  if (opts.stripeCouponId) {
    await stripe.coupons
      .del(opts.stripeCouponId)
      .catch((err) => console.error('[stripe-coupons] coupon delete failed:', err))
  }
}

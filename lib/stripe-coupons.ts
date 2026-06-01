import Stripe from 'stripe'
import { stripe, ensureStripeConfigured } from '@/lib/stripe'

export interface StripePromoResult {
  stripeCouponId: string
  stripePromotionCodeId: string
}

/** True when the configured Stripe key is a live-mode key. */
export function isStripeLiveMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live')
}

/**
 * Pulls the coupon id off a promotion code defensively. Depending on the pinned
 * Stripe API version, the coupon arrives either as a top-level `coupon`
 * (string or expanded object) or nested under `promotion.coupon`.
 */
function extractCouponId(promo: Stripe.PromotionCode): string | null {
  const p = promo as unknown as {
    coupon?: string | { id?: string }
    promotion?: { coupon?: string | { id?: string } }
  }
  if (typeof p.coupon === 'string') return p.coupon
  if (p.coupon && typeof p.coupon === 'object' && p.coupon.id) return p.coupon.id
  if (typeof p.promotion?.coupon === 'string') return p.promotion.coupon
  if (p.promotion?.coupon && typeof p.promotion.coupon === 'object' && p.promotion.coupon.id) {
    return p.promotion.coupon.id
  }
  return null
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

/**
 * Self-healing promo sync. The Supabase DB is shared across environments, but
 * Stripe objects are NOT: a promo created against a test key (e.g. from
 * localhost) is invisible to a live-mode production checkout, which then
 * rejects the code as "invalid". This reconciles a stored promo against the
 * CURRENT Stripe mode:
 *   1. If the stored promotion code resolves in this mode, reuse it (and fix
 *      its active flag if it has drifted).
 *   2. Otherwise recreate it in this mode. If a same-code promo already exists
 *      here (a partial earlier sync), adopt that instead of erroring on the
 *      Stripe uniqueness constraint.
 *
 * Returns the IDs that should be persisted and whether a recreate happened.
 * Throws if Stripe is not configured or an unrecoverable API error occurs.
 */
export async function ensureStripePromo(opts: {
  code: string
  percentOff: number
  active: boolean
  maxRedemptions?: number
  stripeCouponId?: string | null
  stripePromotionCodeId?: string | null
}): Promise<StripePromoResult & { recreated: boolean }> {
  ensureStripeConfigured()
  const code = opts.code.toUpperCase().trim()

  // 1. Does the stored promo still resolve in the current Stripe mode?
  if (opts.stripePromotionCodeId) {
    try {
      const existing = await stripe.promotionCodes.retrieve(opts.stripePromotionCodeId)
      if (existing.active !== opts.active) {
        await stripe.promotionCodes.update(existing.id, { active: opts.active })
      }
      return {
        stripeCouponId: extractCouponId(existing) ?? opts.stripeCouponId ?? '',
        stripePromotionCodeId: existing.id,
        recreated: false,
      }
    } catch {
      // Not found in this mode (created in a different mode, or deleted).
      // Fall through to recreate.
    }
  }

  // 2. Recreate in the current mode.
  try {
    const created = await createStripePromo({
      code,
      percentOff: opts.percentOff,
      active: opts.active,
      maxRedemptions: opts.maxRedemptions,
    })
    return { ...created, recreated: true }
  } catch (err) {
    // A same-code promo may already exist in this mode (Stripe rejects a
    // duplicate active code). Adopt the existing one rather than failing.
    const list = await stripe.promotionCodes.list({ code, limit: 1 }).catch(() => null)
    const found = list?.data?.[0]
    if (found) {
      if (found.active !== opts.active) {
        await stripe.promotionCodes.update(found.id, { active: opts.active }).catch(() => {})
      }
      return {
        stripeCouponId: extractCouponId(found) ?? opts.stripeCouponId ?? '',
        stripePromotionCodeId: found.id,
        recreated: true,
      }
    }
    throw err
  }
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

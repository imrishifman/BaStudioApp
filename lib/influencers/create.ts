import 'server-only'
import { prisma } from '@/lib/prisma'
import { createStripePromo } from '@/lib/stripe-coupons'
import { absoluteUrl } from '@/lib/site'
import type { Influencer, InfluencerStatus } from '@prisma/client'

// Shared influencer creation - the ONE place an Influencer row is born, used by
// both the admin "Add influencer" form (/api/influencers/connect) and the
// Cold Call Manager intake endpoint (/api/integrations/influencer-intake), so
// the Stripe promo, referral link, and portal access are always set up the
// same way.

// Canonical shareable referral link for a coupon code (see app/r/[code]).
// Built from SITE_URL (the brand origin, bastudiopodcast.com), NOT the mutable
// NEXT_PUBLIC_APP_URL, so a customer-facing link is always on the brand domain
// regardless of which deployment URL an env var happens to point at.
export function referralLinkFor(couponCode: string): string {
  return absoluteUrl(`/r/${couponCode}`)
}

// Auto-generate a unique coupon code from a person's name: first word,
// uppercased alphanumerics, + "20" (e.g. "Sarah Donaldson" -> SARAH20).
// Uniqueness is enforced against BOTH Influencer.couponCode and
// CouponCode.code; a numeric suffix is appended if taken (SARAH202, SARAH203).
export async function generateUniqueCouponCode(name: string): Promise<string> {
  const first = (name.trim().split(/\s+/)[0] ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const base = `${first || 'PARTNER'}20`
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`
    const [inf, coupon] = await Promise.all([
      prisma.influencer.findFirst({ where: { couponCode: candidate }, select: { id: true } }),
      prisma.couponCode.findFirst({ where: { code: candidate }, select: { id: true } }),
    ])
    if (!inf && !coupon) return candidate
  }
  // Pathological collision space - fall back to a random suffix.
  return `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export interface CreateInfluencerOptions {
  name: string
  email: string
  handle?: string | null
  couponCode?: string | null // omit to skip; use generateUniqueCouponCode for auto
  commissionValue?: number // percentage points; default 20
  customerDiscount?: number | null // % off for the CUSTOMER; null/0 = attribution-only code
  status?: InfluencerStatus // default 'pending' (admin invite flow); intake passes 'active'
  couponActive?: boolean // default false (activates on agreement signing)
  stripePromoActive?: boolean // default false (activates on agreement signing)
  callerId?: string | null // the caller who onboarded this studio (commission attribution)
}

export interface CreateInfluencerResult {
  influencer: Influencer
  couponWarning: string | null
}

export async function createInfluencer(opts: CreateInfluencerOptions): Promise<CreateInfluencerResult> {
  const normalizedCoupon = opts.couponCode?.toUpperCase().trim() || null
  const discount = opts.customerDiscount && opts.customerDiscount > 0 ? opts.customerDiscount : null

  // Stripe promo exists ONLY when there is a customer-facing discount. A
  // discount-less code is attribution-only (customer pays full price) and needs
  // nothing in Stripe. Best-effort: a Stripe failure never blocks creation.
  let stripeCouponId: string | null = null
  let stripePromotionCodeId: string | null = null
  let couponWarning: string | null = null
  if (normalizedCoupon && discount) {
    try {
      const promo = await createStripePromo({
        code: normalizedCoupon,
        percentOff: discount,
        active: opts.stripePromoActive ?? false,
      })
      stripeCouponId = promo.stripeCouponId
      stripePromotionCodeId = promo.stripePromotionCodeId
    } catch (err) {
      couponWarning = err instanceof Error ? err.message : 'Stripe coupon sync failed'
      console.error('[influencer-coupon] Stripe sync failed:', err)
    }
  }

  const influencer = await prisma.influencer.create({
    data: {
      name: opts.name,
      email: opts.email.toLowerCase().trim(),
      handle: opts.handle ?? null,
      couponCode: normalizedCoupon,
      referralLink: normalizedCoupon ? referralLinkFor(normalizedCoupon) : null,
      commissionType: 'percentage',
      commissionValue: opts.commissionValue ?? 20,
      customerDiscount: discount,
      stripeCouponId,
      stripePromotionCodeId,
      status: opts.status ?? 'pending',
      couponActive: opts.couponActive ?? false,
      callerId: opts.callerId ?? null,
      agreementSignatureToken: crypto.randomUUID(),
      agreementSentDate: new Date(),
    },
  })

  return { influencer, couponWarning }
}

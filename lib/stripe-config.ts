import type { Plan, BillingPeriod } from '@prisma/client'

// Maps a Stripe price ID (live or test) to the in-app plan tier + billing
// period. The four env vars below are set per environment (test in
// dev/preview, live in production).
export interface PriceMeta {
  plan: Extract<Plan, 'solo' | 'master'>
  period: BillingPeriod
}

export function getPriceMap(): Record<string, PriceMeta> {
  const map: Record<string, PriceMeta> = {}
  const solo_m = process.env.STRIPE_PRICE_SOLO_MONTHLY
  const solo_y = process.env.STRIPE_PRICE_SOLO_ANNUAL
  const master_m = process.env.STRIPE_PRICE_MASTER_MONTHLY
  const master_y = process.env.STRIPE_PRICE_MASTER_ANNUAL
  if (solo_m) map[solo_m] = { plan: 'solo', period: 'monthly' }
  if (solo_y) map[solo_y] = { plan: 'solo', period: 'annual' }
  if (master_m) map[master_m] = { plan: 'master', period: 'monthly' }
  if (master_y) map[master_y] = { plan: 'master', period: 'annual' }
  return map
}

// Resolve a (plan, period) request from the client into the env-bound price ID.
export function resolvePriceId(plan: 'solo' | 'master', period: BillingPeriod): string | null {
  if (plan === 'solo' && period === 'monthly') return process.env.STRIPE_PRICE_SOLO_MONTHLY ?? null
  if (plan === 'solo' && period === 'annual') return process.env.STRIPE_PRICE_SOLO_ANNUAL ?? null
  if (plan === 'master' && period === 'monthly') return process.env.STRIPE_PRICE_MASTER_MONTHLY ?? null
  if (plan === 'master' && period === 'annual') return process.env.STRIPE_PRICE_MASTER_ANNUAL ?? null
  return null
}

// Map Stripe subscription status string -> our PlanStatus enum.
export function mapStripeStatus(s: string): 'active' | 'trialing' | 'past_due' | 'cancelled' {
  switch (s) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'unpaid': return 'past_due'
    case 'incomplete': return 'past_due'
    case 'incomplete_expired': return 'cancelled'
    case 'canceled': return 'cancelled'
    case 'paused': return 'cancelled'
    default: return 'cancelled'
  }
}

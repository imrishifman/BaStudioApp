import type { BillingPeriod } from '@prisma/client'

// Influencer commissions are paid on PROFIT, not gross revenue. Profit is the
// charged amount minus Stripe processing fees minus our estimated cost to serve
// that customer. The AI cost is a realistic monthly average per plan (not a
// worst-case "user maxes out everything" figure).

const STRIPE_PCT = 0.029
const STRIPE_FLAT = 0.3

// Estimated AI/infrastructure cost to serve one customer for one month, by plan.
const MONTHLY_AI_COST: Record<'solo' | 'master', number> = {
  solo: 3,
  master: 6,
}

export function stripeFee(amount: number): number {
  return amount * STRIPE_PCT + STRIPE_FLAT
}

// Net profit on a single charge. `revenueAmount` is the amount actually charged
// for the period (monthly amount for monthly plans, full annual amount for
// annual plans), so the AI cost is scaled to match the billing period.
export function estimateProfit(
  plan: 'solo' | 'master',
  period: BillingPeriod,
  revenueAmount: number,
): number {
  const months = period === 'annual' ? 12 : 1
  const aiCost = MONTHLY_AI_COST[plan] * months
  return Math.max(0, revenueAmount - stripeFee(revenueAmount) - aiCost)
}

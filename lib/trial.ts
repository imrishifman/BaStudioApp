// Reverse-trial logic, mapped onto the existing plan fields (no new enum).
//
// A reverse-trial user is represented as:
//   plan        = 'solo'        -> isPaidPlan() true, so full Pro access
//   planStatus  = 'trialing'
//   planOverride = true          -> marks it as a non-Stripe grant
//   trialEndsAt  = now + 7 days
//   stripeSubscriptionId = null  -> no real subscription
//
// This means the paywall (isPaidPlan) treats trial users as Pro automatically,
// with zero middleware changes. These helpers are PURE (no Prisma / no
// next/server) so they're safe in both client and server code.

const TRIAL_DAYS = 7
export const TRIAL_LENGTH_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000

export interface TrialFields {
  plan: string
  planStatus?: string | null
  planOverride?: boolean | null
  trialEndsAt?: Date | string | null
  stripeSubscriptionId?: string | null
}

function endMs(u: TrialFields): number | null {
  if (!u.trialEndsAt) return null
  const d = typeof u.trialEndsAt === 'string' ? new Date(u.trialEndsAt) : u.trialEndsAt
  const ms = d.getTime()
  return Number.isNaN(ms) ? null : ms
}

// Is this row one of our reverse trials (vs a real Stripe customer or free)?
export function isReverseTrial(u: TrialFields): boolean {
  return (
    u.planStatus === 'trialing' &&
    !!u.planOverride &&
    !u.stripeSubscriptionId &&
    endMs(u) !== null
  )
}

// Trial that has run past its end date (but DB may not be downgraded yet).
export function isTrialExpired(u: TrialFields, now: number): boolean {
  const end = endMs(u)
  return isReverseTrial(u) && end !== null && now > end
}

// Active (not yet expired) reverse trial.
export function isTrialActive(u: TrialFields, now: number): boolean {
  const end = endMs(u)
  return isReverseTrial(u) && end !== null && now <= end
}

// Whole days left, rounded up, floored at 0.
export function trialDaysLeft(u: TrialFields, now: number): number {
  const end = endMs(u)
  if (end === null) return 0
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)))
}

// The plan to ENFORCE right now. An expired-but-not-yet-downgraded trial reads
// as 'free' immediately, so access is revoked the instant the clock passes the
// end date, even before the daily cron rewrites the row.
export function effectivePlan(u: TrialFields, now: number): string {
  if (isTrialExpired(u, now)) return 'free'
  return u.plan
}

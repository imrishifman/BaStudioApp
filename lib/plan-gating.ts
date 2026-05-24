import type { Plan } from '@prisma/client'
import type { Session } from 'next-auth'
import { isAdmin as isAdminEmail } from './admin'

// Normalise legacy plan names from base44 source
export function normalisePlan(plan: string | null | undefined): Plan {
  if (!plan) return 'free'
  if (plan === 'creator') return 'solo'
  if (plan === 'team' || plan === 'agency') return 'master'
  return plan as Plan
}

const PLAN_RANK: Record<Plan, number> = { free: 0, solo: 1, master: 2 }

export function canAccess(
  user: Session['user'] | null | undefined,
  requiredPlan: Plan
): boolean {
  if (!user) return false
  if (isAdminEmail(user.email)) return true
  const userPlan = normalisePlan(user.plan)
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan]
}

export function isAdmin(user: Session['user'] | null | undefined): boolean {
  if (!user) return false
  return user.role === 'admin' || isAdminEmail(user.email)
}

export function episodesThisMonth<
  T extends { createdByEmail: string; createdAt: Date },
>(episodes: T[], email: string): T[] {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return episodes.filter(
    (ep) => ep.createdByEmail === email && ep.createdAt >= firstOfMonth
  )
}

export function maxEpisodesPerMonth(plan: Plan): number {
  switch (plan) {
    case 'free':
      return 1
    case 'solo':
      return 4
    case 'master':
      return Infinity
  }
}

export function nextMonthReset(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

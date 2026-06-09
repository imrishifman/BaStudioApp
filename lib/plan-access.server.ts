import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/plan-access'
import { effectivePlan } from '@/lib/trial'

// Server-side paywall guard. Returns a 402 NextResponse when the signed-in
// user is on the (effective) free plan, or null when allowed. Trial-aware: an
// expired-but-not-yet-downgraded trial is blocked immediately. Mirrors the UI
// gate but is the real enforcement.
export async function blockFreePlan(email: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { plan: true, planStatus: true, planOverride: true, trialEndsAt: true, stripeSubscriptionId: true },
  })
  const plan = user ? effectivePlan(user, Date.now()) : 'free'
  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 402 })
  }
  return null
}

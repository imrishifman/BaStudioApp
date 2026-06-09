import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/plan-access'

// Server-side paywall guard. Returns a 402 NextResponse when the signed-in
// user is on the free plan, or null when allowed. Call at the top of any
// share/export route. Mirrors the UI gate but is the real enforcement.
export async function blockFreePlan(email: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { plan: true },
  })
  if (!isPaidPlan(user?.plan)) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 402 })
  }
  return null
}

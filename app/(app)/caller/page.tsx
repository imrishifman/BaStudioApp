import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { GlassCard } from '@/components/common/GlassCard'
import { getCommissionConfig } from '@/lib/commission/config'
import { periodOf, isWithinCallerWindow } from '@/lib/commission/engine'
import { CallerClient } from './caller-client'

export const dynamic = 'force-dynamic'

// Stable, non-reversible short token so a caller sees an anonymized id per user
// (never the email / PII), per the brief.
function anonId(email: string): string {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0
  return `U-${h.toString(36).slice(0, 6).toUpperCase()}`
}

export default async function CallerPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  const email = session.user.email.toLowerCase()

  const caller = await prisma.caller.findUnique({ where: { email } })
  if (!caller) {
    return (
      <div className="mx-auto max-w-2xl p-6 lg:p-8">
        <GlassCard className="space-y-3 p-8 text-center">
          <h1 className="display-sm text-[var(--ink-1)]">You&apos;re not a caller yet</h1>
          <p className="body text-[var(--ink-2)]">This area is for Ba Studio callers. If you should have access, ask the admin to add your email.</p>
        </GlassCard>
      </div>
    )
  }

  const cfg = await getCommissionConfig()
  const period = periodOf(new Date())
  const now = new Date()

  const studios = await prisma.influencer.findMany({
    where: { callerId: caller.id },
    select: { id: true, name: true, couponCode: true, activatedDate: true, status: true },
  })
  const studioIds = studios.map((s) => s.id)
  const studioName = new Map(studios.map((s) => [s.id, s.name]))

  const [referred, monthAgg, totalAgg, pendingAgg, historyGroups] = await Promise.all([
    studioIds.length
      ? prisma.referredUser.findMany({ where: { studioId: { in: studioIds } }, select: { userEmail: true, plan: true, status: true, firstPaymentDate: true, studioId: true, activated: true } })
      : Promise.resolve([]),
    prisma.commissionEvent.aggregate({ where: { recipientType: 'caller', recipientId: caller.id, period }, _sum: { amount: true } }),
    prisma.commissionEvent.aggregate({ where: { recipientType: 'caller', recipientId: caller.id }, _sum: { amount: true } }),
    prisma.commissionEvent.aggregate({ where: { recipientType: 'caller', recipientId: caller.id, status: 'pending' }, _sum: { amount: true } }),
    prisma.commissionEvent.groupBy({ by: ['period'], where: { recipientType: 'caller', recipientId: caller.id }, _sum: { amount: true }, orderBy: { period: 'desc' }, take: 12 }),
  ])

  const activatedCount = studios.filter((s) => s.activatedDate).length
  const perStudioCounts = new Map<string, { referred: number; active: number }>()
  for (const s of studioIds) perStudioCounts.set(s, { referred: 0, active: 0 })
  let inWindow = 0
  let expired = 0
  const users = referred.map((u) => {
    const c = perStudioCounts.get(u.studioId)!
    c.referred++
    if (u.status === 'active') c.active++
    const within = isWithinCallerWindow(u.firstPaymentDate, now, cfg)
    if (u.status === 'active') { if (within) inWindow++; else expired++ }
    return {
      token: anonId(u.userEmail),
      studio: studioName.get(u.studioId) ?? u.studioId,
      plan: u.plan,
      status: u.status,
      signupDate: u.firstPaymentDate ? u.firstPaymentDate.toISOString().slice(0, 10) : null,
      inWindow: within,
    }
  })

  const round2 = (n: number) => Math.round(n * 100) / 100
  const toNext = cfg.bonusPerNStudios > 0 ? activatedCount % cfg.bonusPerNStudios : 0

  return (
    <CallerClient
      name={caller.name}
      config={{ bonusPerNStudios: cfg.bonusPerNStudios, bonusAmount: cfg.bonusAmount, callerDurationMonths: cfg.callerDurationMonths, callerRate: cfg.callerRate }}
      earnings={{
        thisMonth: round2(monthAgg._sum.amount ?? 0),
        total: round2(totalAgg._sum.amount ?? 0),
        pending: round2(pendingAgg._sum.amount ?? 0),
        history: historyGroups.map((h) => ({ period: h.period, amount: round2(h._sum.amount ?? 0) })),
      }}
      studios={studios.map((s) => ({
        id: s.id, name: s.name, code: s.couponCode, activated: !!s.activatedDate, status: s.status,
        referred: perStudioCounts.get(s.id)?.referred ?? 0, active: perStudioCounts.get(s.id)?.active ?? 0,
      }))}
      bonus={{ activatedCount, toNext, perN: cfg.bonusPerNStudios }}
      windowCounts={{ inWindow, expired }}
      users={users}
    />
  )
}

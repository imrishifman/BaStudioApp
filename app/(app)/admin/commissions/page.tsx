import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { getCommissionConfig } from '@/lib/commission/config'
import { periodOf } from '@/lib/commission/engine'
import { CommissionsClient } from './commissions-client'

export const dynamic = 'force-dynamic'

// Admin commissions dashboard. Same auth pattern as the rest of /admin.
export default async function CommissionsPage() {
  const session = await auth()
  if (!session) redirect('/?signin=1')
  if (!isAdmin(session.user.email)) redirect('/studio')

  const period = periodOf(new Date())
  const cfg = await getCommissionConfig()

  const [callers, studios, activatedByCaller, studioCountByCaller, periodEvents, pendingGroups] = await Promise.all([
    prisma.caller.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.influencer.findMany({
      where: { couponCode: { not: null } },
      select: { id: true, name: true, couponCode: true, callerId: true, activatedDate: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.influencer.groupBy({ by: ['callerId'], where: { activatedDate: { not: null } }, _count: { _all: true } }),
    prisma.influencer.groupBy({ by: ['callerId'], where: { callerId: { not: null } }, _count: { _all: true } }),
    prisma.commissionEvent.findMany({ where: { period }, select: { recipientType: true, type: true, status: true, amount: true, amountGross: true, stripeFee: true } }),
    prisma.commissionEvent.groupBy({
      by: ['recipientType', 'recipientId', 'period'],
      where: { status: 'pending' },
      _sum: { amount: true },
    }),
  ])

  // Current-period roll-up (referred revenue). Studio commission rows carry one
  // gross per payment; caller rows duplicate the same gross, so gross/fees come
  // from studio rows only.
  const sum = (pred: (e: (typeof periodEvents)[number]) => boolean, field: 'amount' | 'amountGross' | 'stripeFee') =>
    periodEvents.filter(pred).reduce((s, e) => s + e[field], 0)
  const round2 = (n: number) => Math.round(n * 100) / 100
  const referredGross = round2(sum((e) => e.recipientType === 'studio' && e.type === 'commission', 'amountGross') + sum((e) => e.recipientType === 'studio' && e.type === 'clawback', 'amountGross'))
  const fees = round2(sum((e) => e.recipientType === 'studio' && e.type === 'commission', 'stripeFee') + sum((e) => e.recipientType === 'studio' && e.type === 'clawback', 'stripeFee'))
  const studioOwed = round2(sum((e) => e.recipientType === 'studio', 'amount'))
  const callerOwed = round2(sum((e) => e.recipientType === 'caller' && e.type !== 'bonus', 'amount'))
  const bonusOwed = round2(sum((e) => e.type === 'bonus', 'amount'))
  const liabilityPending = round2(periodEvents.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0))
  const net = round2(referredGross - fees - studioOwed - callerOwed - bonusOwed)

  // Resolve names for the pending payouts table.
  const callerName = new Map(callers.map((c) => [c.id, c.name]))
  const studioName = new Map(studios.map((s) => [s.id, s.name]))
  const payouts = pendingGroups
    .map((g) => ({
      recipientType: g.recipientType,
      recipientId: g.recipientId,
      period: g.period,
      amount: round2(g._sum.amount ?? 0),
      name: (g.recipientType === 'caller' ? callerName.get(g.recipientId) : studioName.get(g.recipientId)) ?? g.recipientId,
    }))
    .filter((p) => Math.abs(p.amount) > 0.0001)
    .sort((a, b) => (b.period.localeCompare(a.period) || b.amount - a.amount))

  const activatedMap = new Map(activatedByCaller.map((r) => [r.callerId, r._count._all]))
  const studioCountMap = new Map(studioCountByCaller.map((r) => [r.callerId, r._count._all]))
  const callersView = callers.map((c) => ({
    id: c.id, name: c.name, email: c.email, status: c.status,
    studioCount: studioCountMap.get(c.id) ?? 0,
    activatedCount: activatedMap.get(c.id) ?? 0,
  }))
  const studiosView = studios.map((s) => ({
    id: s.id, name: s.name, couponCode: s.couponCode, callerId: s.callerId,
    activated: !!s.activatedDate, status: s.status,
  }))

  return (
    <CommissionsClient
      period={period}
      config={cfg}
      summary={{ referredGross, fees, studioOwed, callerOwed, bonusOwed, liabilityPending, net }}
      payouts={payouts}
      callers={callersView}
      studios={studiosView}
    />
  )
}

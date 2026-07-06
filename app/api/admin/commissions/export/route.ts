import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

// Monthly payout report: one row per recipient per period per status, with the
// summed amount owed. Admin-only. Follows the ICS route's download pattern.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const groups = await prisma.commissionEvent.groupBy({
    by: ['recipientType', 'recipientId', 'period', 'status'],
    _sum: { amount: true },
    orderBy: [{ period: 'desc' }],
  })

  const callers = new Map((await prisma.caller.findMany({ select: { id: true, name: true, email: true } })).map((c) => [c.id, c]))
  const studios = new Map((await prisma.influencer.findMany({ select: { id: true, name: true, email: true } })).map((s) => [s.id, s]))

  const header = ['Period', 'Recipient type', 'Recipient', 'Email', 'Status', 'Amount USD']
  const rows = groups
    .map((g) => {
      const r = g.recipientType === 'caller' ? callers.get(g.recipientId) : studios.get(g.recipientId)
      return {
        period: g.period,
        type: g.recipientType,
        name: r?.name ?? g.recipientId,
        email: r?.email ?? '',
        status: g.status,
        amount: Math.round((g._sum.amount ?? 0) * 100) / 100,
      }
    })
    .filter((r) => Math.abs(r.amount) > 0.0001)
    .sort((a, b) => b.period.localeCompare(a.period) || a.type.localeCompare(b.type))

  const csv = [header, ...rows.map((r) => [r.period, r.type, r.name, r.email, r.status, r.amount])]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="commissions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

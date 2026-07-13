import 'server-only'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { recordInvoicePayment } from './events'

// Money safety net. The webhook is the primary path for recording commissions;
// this is the backstop that makes "everyone gets paid on time" true even if the
// webhook is misconfigured, unsubscribed, or briefly down.
//
// Because recording is idempotent (unique key + createMany skipDuplicates),
// replaying an already-recorded invoice writes zero new rows. So we can safely
// re-run every recently-paid invoice through the SAME recorder the webhook uses:
//   - anything already handled -> 0 new rows (no double-pay, ever)
//   - anything the webhook MISSED -> backfilled here within a day
// The number of rows written during a sweep is our health signal: a non-zero
// count means the live webhook is not delivering and needs attention.

const MAX_INVOICES = 1000 // safety cap so a huge account can't run the job away

export interface ReconcileResult {
  scanned: number
  recovered: number
}

export async function reconcileRecentInvoices(days = 35): Promise<ReconcileResult> {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  let scanned = 0
  let recovered = 0

  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: since },
    limit: 100,
    expand: ['data.charge'],
  })) {
    if (scanned >= MAX_INVOICES) break
    scanned++
    try {
      recovered += await recordInvoicePayment(invoice)
    } catch {
      // A single bad invoice never aborts the sweep - the rest still reconcile.
    }
  }

  return { scanned, recovered }
}

export interface PayoutLine {
  recipientType: 'studio' | 'caller'
  recipientId: string
  name: string
  email: string | null
  period: string
  amount: number
}

// Everything currently owed and unpaid, grouped per recipient per period, with
// the recipient's name + payout email resolved. This is exactly what an admin
// needs to send money out - the data behind the monthly summary email and the
// dashboard's Pending payouts table.
export async function pendingPayoutLines(): Promise<PayoutLine[]> {
  const groups = await prisma.commissionEvent.groupBy({
    by: ['recipientType', 'recipientId', 'period'],
    where: { status: 'pending' },
    _sum: { amount: true },
  })

  const callerIds = [...new Set(groups.filter((g) => g.recipientType === 'caller').map((g) => g.recipientId))]
  const studioIds = [...new Set(groups.filter((g) => g.recipientType === 'studio').map((g) => g.recipientId))]

  const [callers, studios] = await Promise.all([
    callerIds.length ? prisma.caller.findMany({ where: { id: { in: callerIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    studioIds.length ? prisma.influencer.findMany({ where: { id: { in: studioIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
  ])
  const callerMap = new Map(callers.map((c) => [c.id, c]))
  const studioMap = new Map(studios.map((s) => [s.id, s]))
  const round2 = (n: number) => Math.round(n * 100) / 100

  return groups
    .map((g) => {
      const who = g.recipientType === 'caller' ? callerMap.get(g.recipientId) : studioMap.get(g.recipientId)
      return {
        recipientType: g.recipientType,
        recipientId: g.recipientId,
        name: who?.name ?? g.recipientId,
        email: who?.email ?? null,
        period: g.period,
        amount: round2(g._sum.amount ?? 0),
      }
    })
    .filter((l) => Math.abs(l.amount) > 0.0001)
    .sort((a, b) => b.period.localeCompare(a.period) || b.amount - a.amount)
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getResend } from '@/lib/email/client'
import {
  OUTREACH_COHORT,
  OUTREACH_FROM,
  OUTREACH_REPLY_TO,
  buildOutreachEmail,
  outreachGreeting,
} from '@/lib/email/outreach'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

// One-off founder research outreach to the approved 31-person cohort.
//   GET  -> dry run: resolve the cohort, show who is pending/sent/skipped (no send)
//   POST -> send up to ?limit (default 20) pending emails, log each to OutreachLog
// Both require Authorization: Bearer <CRON_SECRET>. Idempotent: a userId already
// logged as 'sent' is never emailed again, so POST can be called once per hour
// to honour the 20/hour rate limit (20 now, the remainder next hour).

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

type Resolved = {
  userId: string
  variant: 'activated' | 'bounced'
  email: string
  greeting: string
  guestName: string | null
  eligible: boolean
  skipReason?: string
}

async function resolveCohort(): Promise<Resolved[]> {
  const ids = OUTREACH_COHORT.map((c) => c.id)
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      fullName: true,
      plan: true,
      stripeSubscriptionId: true,
      marketingEmailOptIn: true,
    },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  const out: Resolved[] = []
  for (const entry of OUTREACH_COHORT) {
    const u = byId.get(entry.id)
    if (!u) {
      out.push({ userId: entry.id, variant: entry.variant, email: '', greeting: 'there', guestName: null, eligible: false, skipReason: 'user_not_found' })
      continue
    }
    // Safety re-checks so we never email someone who paid or opted out since.
    let skipReason: string | undefined
    if (u.plan !== 'free') skipReason = 'no_longer_free'
    else if (u.stripeSubscriptionId) skipReason = 'has_subscription'
    else if (u.marketingEmailOptIn === false) skipReason = 'opted_out'

    let guestName: string | null = null
    if (entry.variant === 'activated') {
      const ep = await prisma.episode.findFirst({
        where: { createdByEmail: u.email, fullScript: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { guestName: true },
      })
      guestName = ep?.guestName?.trim() ?? null
    }

    out.push({
      userId: u.id,
      variant: entry.variant,
      email: u.email,
      greeting: outreachGreeting(u.id, u.fullName),
      guestName,
      eligible: !skipReason,
      skipReason,
    })
  }
  return out
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resolved = await resolveCohort()
  const sent = await prisma.outreachLog.findMany({ where: { status: 'sent' }, select: { userId: true } })
  const sentIds = new Set(sent.map((r) => r.userId))
  return NextResponse.json({
    dryRun: true,
    total: resolved.length,
    alreadySent: resolved.filter((r) => sentIds.has(r.userId)).length,
    pending: resolved.filter((r) => r.eligible && !sentIds.has(r.userId)).length,
    ineligible: resolved.filter((r) => !r.eligible).map((r) => ({ email: r.email, reason: r.skipReason })),
    recipients: resolved.map((r) => ({ email: r.email, variant: r.variant, greeting: r.greeting, guestName: r.guestName, eligible: r.eligible, alreadySent: sentIds.has(r.userId) })),
  })
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') ?? '20')))

  const resend = getResend()
  if (!resend) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })

  const resolved = await resolveCohort()
  const sent = await prisma.outreachLog.findMany({ where: { status: 'sent' }, select: { userId: true } })
  const sentIds = new Set(sent.map((r) => r.userId))

  // Log skips for ineligible users once (so the report can account for them).
  const skipped: string[] = []
  for (const r of resolved) {
    if (r.eligible || sentIds.has(r.userId)) continue
    const already = await prisma.outreachLog.findFirst({ where: { userId: r.userId, status: 'skipped' } })
    if (!already) {
      await prisma.outreachLog.create({ data: { userId: r.userId, email: r.email, variant: r.variant, status: 'skipped', error: r.skipReason } })
    }
    skipped.push(r.email)
  }

  const pending = resolved.filter((r) => r.eligible && !sentIds.has(r.userId)).slice(0, limit)

  let sentCount = 0
  let failedCount = 0
  const results: { email: string; status: string; error?: string }[] = []
  for (const r of pending) {
    const { subject, text } = buildOutreachEmail({ variant: r.variant, greeting: r.greeting, guestName: r.guestName })
    try {
      const resp = await resend.emails.send({
        from: OUTREACH_FROM,
        to: r.email,
        replyTo: OUTREACH_REPLY_TO,
        subject,
        text,
      })
      if (resp.error) throw new Error(resp.error.message)
      await prisma.outreachLog.create({ data: { userId: r.userId, email: r.email, variant: r.variant, status: 'sent', sentAt: new Date(), resendId: resp.data?.id ?? null } })
      sentCount++
      results.push({ email: r.email, status: 'sent' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'send_failed'
      await prisma.outreachLog.create({ data: { userId: r.userId, email: r.email, variant: r.variant, status: 'failed', error: msg } })
      failedCount++
      results.push({ email: r.email, status: 'failed', error: msg })
    }
  }

  const remaining = resolved.filter((r) => r.eligible && !sentIds.has(r.userId)).length - sentCount
  return NextResponse.json({ batchLimit: limit, sent: sentCount, failed: failedCount, skipped: skipped.length, remaining, results })
}

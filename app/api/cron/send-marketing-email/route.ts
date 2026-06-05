// Vercel cron worker. Scheduled at Mon/Wed/Fri 14:00 UTC (= 10am EDT in
// summer, 9am EST in winter; see vercel.json) to send the next queued
// marketing campaign to every free-plan user who hasn't unsubscribed.
//
// Auth: CRON_SECRET must match the Authorization: Bearer header. Vercel Cron
// sends this automatically when the env var is set on the project.
//
// Behavior:
//   - Pick the oldest DRAFT campaign (FIFO). If none, no-op (200).
//   - Find every recipient: plan='free' AND marketingEmailOptIn=true.
//   - Send in batches of 50 via Resend, one Bcc per batch is NOT used (so each
//     recipient gets a personalised unsubscribe link). Real loop with
//     a small concurrency cap to stay under Resend's rate limit.
//   - Flip the campaign to SENT with sentCount + sentAt.

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getResend, RESEND_FROM } from '@/lib/email/client'
import { buildMarketingHtml } from '@/lib/email/marketing'
import { ensureUnsubscribeToken } from '@/lib/email/unsubscribe'
import { generateCampaignForAudience, type GenAudience } from '@/lib/email/generate'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Small parallel worker. Resend allows 10 requests/sec on the default plan;
// chunks of 8 stay safely under that.
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      try {
        out[idx] = await fn(items[idx])
      } catch (err) {
        console.error('Marketing send error for one recipient:', err)
        out[idx] = null as unknown as R
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

export async function GET(req: Request) {
  // Auth check: Vercel Cron passes Authorization: Bearer <CRON_SECRET>.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const got = req.headers.get('authorization')
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = getResend()
  if (!resend) {
    return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })
  }

  // Pick the oldest queued + approved campaign. No-op if the queue is empty
  // or if every DRAFT is still awaiting human review (needsReview=true).
  const campaign = await prisma.marketingEmailCampaign.findFirst({
    where: { status: 'DRAFT', needsReview: false },
    orderBy: { createdAt: 'asc' },
  })
  if (!campaign) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no_draft_campaign' })
  }

  // Recipient cohort. Filters by the campaign's audience choice (FREE / SOLO /
  // MASTER / ALL); always respects the marketing opt-in flag.
  const where: Prisma.UserWhereInput = {
    marketingEmailOptIn: true,
    email: { not: '' },
  }
  switch (campaign.audience) {
    case 'FREE':   where.plan = 'free'; break
    case 'SOLO':   where.plan = 'solo'; break
    case 'MASTER': where.plan = 'master'; break
    case 'ALL':    /* no plan filter */ break
  }
  const recipients = await prisma.user.findMany({
    where,
    select: { id: true, email: true, unsubscribeToken: true },
  })

  let sentCount = 0
  await mapWithConcurrency(recipients, 8, async (user) => {
    const token = await ensureUnsubscribeToken(user.id, user.unsubscribeToken)
    const html = buildMarketingHtml({
      bodyHtml: campaign.html,
      preheader: campaign.preheader,
      unsubscribeToken: token,
    })
    await resend.emails.send({
      from: RESEND_FROM,
      to: user.email,
      subject: campaign.subject,
      html,
      headers: {
        // List-Unsubscribe enables one-click unsubscribe in Gmail/Outlook,
        // which protects sender reputation.
        'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bastudiopodcast.com'}/unsubscribe?token=${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    sentCount++
  })

  await prisma.marketingEmailCampaign.update({
    where: { id: campaign.id },
    data: { status: 'SENT', sentAt: new Date(), sentCount },
  })

  // Refill: queue a fresh AI draft for the same audience so the queue is
  // always one slot ahead. Skipped when audience is ALL (one-off announcements
  // don't need topping up) or when the AI key is unavailable. Best-effort:
  // never block the SENT response on the refill.
  let refill: { campaignId?: string; error?: string; skipped?: true } = {}
  if (campaign.audience === 'ALL') {
    refill = { skipped: true }
  } else {
    const result = await generateCampaignForAudience(campaign.audience as GenAudience)
    refill = result
  }

  return NextResponse.json({ ok: true, campaignId: campaign.id, sent: sentCount, refill })
}

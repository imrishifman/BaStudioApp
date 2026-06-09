// Daily cron. Two jobs over the reverse-trial population:
//   1. Day-5 reminder: trials with ~2 days left that haven't been reminded.
//   2. Expiry: trials past their end date -> downgrade to free + expiry email.
//
// Data is never deleted; we only flip plan fields. Episodes stay, they just
// become read-only for exports/sharing (the paywall gates handle that).
//
// Auth: CRON_SECRET bearer token (same as the other crons).
// Scheduled daily (Vercel Hobby caps cron at daily). Prompt access revocation
// does NOT depend on this cron: the effective-plan check in the session + the
// server guards treat an expired trial as free the instant the clock passes
// the end date. This cron just persists the downgrade and sends the emails.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { trialDaysLeft } from '@/lib/trial'
import { sendTrialReminderEmail, sendTrialExpiredEmail } from '@/lib/email/trial'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Static promo code referenced in the expiry email. Must exist as an active
// 20%-off promotion code in Stripe (checkout has allow_promotion_codes: true).
const COMEBACK_COUPON = process.env.TRIAL_COMEBACK_COUPON ?? 'COMEBACK20'

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const nowDate = new Date(now)

  // ── Job 1: day-5 reminders ───────────────────────────────────────────────
  // Active reverse trials with 2 (or fewer) days left, not yet reminded.
  const reminderCutoff = new Date(now + 2 * 24 * 60 * 60 * 1000)
  const reminderCandidates = await prisma.user.findMany({
    where: {
      planStatus: 'trialing',
      planOverride: true,
      stripeSubscriptionId: null,
      trialReminderSent: false,
      trialEndsAt: { gt: nowDate, lte: reminderCutoff },
    },
    select: { email: true, fullName: true },
  })
  let reminded = 0
  for (const u of reminderCandidates) {
    const ok = await sendTrialReminderEmail(u.email, u.fullName?.split(' ')[0] ?? null)
    if (ok) {
      await prisma.user.update({ where: { email: u.email }, data: { trialReminderSent: true } })
      reminded++
    }
  }

  // ── Job 2: expiry + downgrade ─────────────────────────────────────────────
  const expired = await prisma.user.findMany({
    where: {
      planStatus: 'trialing',
      planOverride: true,
      stripeSubscriptionId: null,
      trialEndsAt: { lte: nowDate },
    },
    select: { email: true, fullName: true },
  })
  let downgraded = 0
  for (const u of expired) {
    // Downgrade to free. Keep trialEndsAt so the expiry modal can fire once and
    // so we know this user was a trial (for trial_converted_to_paid later).
    await prisma.user.update({
      where: { email: u.email },
      data: { plan: 'free', planStatus: 'active', planOverride: false },
    })
    await sendTrialExpiredEmail(u.email, u.fullName?.split(' ')[0] ?? null, COMEBACK_COUPON)
    downgraded++
  }

  return NextResponse.json({ ok: true, reminded, downgraded })
}

// Single daily cron dispatcher.
//
// Vercel Hobby caps the number of cron jobs and their frequency. Instead of
// three separate cron entries (which can exceed the Hobby limit), we register
// ONE daily cron and fan out to the individual job endpoints by weekday,
// preserving each job's original cadence:
//   - every day      -> expire-trials (downgrade + day-5/expiry emails)
//   - Mon/Wed/Fri     -> send-marketing-email
//   - Sunday          -> generate-marketing-emails
//
// The individual endpoints stay in place (still callable directly with the
// CRON_SECRET for manual runs); this just orchestrates them.

import { NextResponse } from 'next/server'
import { generateSeoReport } from '@/lib/seo/report'
import { activateEligibleReferredUsers } from '@/lib/commission/events'
import { reconcileRecentInvoices } from '@/lib/commission/reconcile'
import { sendWebhookHealthAlert, sendMonthlyPayoutSummary } from '@/lib/email/commission'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'bastudiopodcast.com'}`
  const headers = { Authorization: `Bearer ${secret}` }

  async function run(path: string): Promise<unknown> {
    try {
      const res = await fetch(`${base}${path}`, { headers })
      return await res.json().catch(() => ({ status: res.status }))
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'failed' }
    }
  }

  // 0 = Sunday ... 6 = Saturday (UTC, matching the cron schedule timezone).
  const day = new Date().getUTCDay()
  const results: Record<string, unknown> = {}

  results.trials = await run('/api/cron/expire-trials')
  if (day === 1 || day === 3 || day === 5) {
    results.marketingSend = await run('/api/cron/send-marketing-email')
  }
  if (day === 0) {
    results.marketingGenerate = await run('/api/cron/generate-marketing-emails')
  }
  // Daily, but the endpoint self-skips unless the IG token is within 20 days of
  // expiry, so this is a cheap no-op most days.
  results.igToken = await run('/api/cron/refresh-ig-token')

  // Daily SEO report (Search Console + GA4 + AI referrals -> Claude). Called
  // directly (not over HTTP) since it's a server function; failures are logged
  // into the result, never break the cron.
  try {
    const report = await generateSeoReport()
    results.seoReport = { ok: true, id: report.id, emailed: report.emailed }
  } catch (err) {
    results.seoReport = { error: err instanceof Error ? err.message : 'failed' }
  }

  // Commission tracking: activate referred users who have been paying for 30+
  // days (covers annual plans + any missed monthly signal) and credit any
  // caller bonuses their activation crosses.
  try {
    const activated = await activateEligibleReferredUsers()
    results.commissionActivations = { ok: true, activated }
  } catch (err) {
    results.commissionActivations = { error: err instanceof Error ? err.message : 'failed' }
  }

  // Money safety net: replay recent paid Stripe invoices through the idempotent
  // recorder. Backfills anything the webhook missed (self-healing) and, if it
  // had to recover any, alerts the admin that the webhook needs fixing.
  try {
    const recon = await reconcileRecentInvoices()
    results.commissionReconcile = recon
    if (recon.recovered > 0) {
      const alerted = await sendWebhookHealthAlert(recon.recovered, recon.scanned).catch(() => false)
      results.commissionReconcile = { ...recon, alerted }
    }
  } catch (err) {
    results.commissionReconcile = { error: err instanceof Error ? err.message : 'failed' }
  }

  // On the 1st of the month (UTC), email the admin everything owed and unpaid so
  // a payout period is never forgotten. Self-skips when nothing is due.
  if (new Date().getUTCDate() === 1) {
    try {
      results.payoutSummary = { sent: await sendMonthlyPayoutSummary() }
    } catch (err) {
      results.payoutSummary = { error: err instanceof Error ? err.message : 'failed' }
    }
  }

  // NOTE: the social auto-poster (generate / publish / report) runs on its own
  // cron at /api/cron/social (17:00 UTC = 1 PM New York), not here, so the
  // posting time is independent of these 13:00 UTC jobs.

  return NextResponse.json({ ok: true, day, results })
}

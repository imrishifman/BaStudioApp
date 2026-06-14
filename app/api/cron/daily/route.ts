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

  // Social auto-poster:
  //   Sunday      -> generate next week's posts (emails Imri for approval)
  //   every day   -> publish any APPROVED posts that are due
  //   Monday      -> weekly recap email
  if (day === 0) {
    results.socialGenerate = await run('/api/social/generate')
  }
  results.socialPublish = await run('/api/social/publish')
  if (day === 1) {
    results.socialReport = await run('/api/social/report')
  }

  return NextResponse.json({ ok: true, day, results })
}

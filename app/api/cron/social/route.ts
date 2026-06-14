// Social auto-poster cron, separate from the 13:00 UTC daily dispatcher so the
// posting time can be tuned without moving the trial/marketing jobs.
// Scheduled at 17:00 UTC = 1:00 PM New York (EDT). Note: fixed in UTC, so when
// New York switches to EST (winter) this lands at 12:00 PM NY; adjust the
// vercel.json schedule to "0 18 * * *" then if you want to hold 1 PM NY.
//   - every day  -> publish any APPROVED posts that are due (this is the 1 PM NY post time)
//   - Sunday     -> generate next week's posts (emails Imri for approval)
//   - Monday     -> weekly recap email
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

  const day = new Date().getUTCDay() // 0 = Sunday
  const results: Record<string, unknown> = {}

  if (day === 0) results.generate = await run('/api/social/generate')
  results.publish = await run('/api/social/publish') // 1 PM NY post time
  if (day === 1) results.report = await run('/api/social/report')

  return NextResponse.json({ ok: true, day, results })
}

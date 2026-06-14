// Cron: rotate the Instagram long-lived token before it expires.
// The token lasts ~60 days; we refresh when fewer than 20 days remain so a
// failed run has plenty of retries. Protected by CRON_SECRET. Wired into the
// daily dispatcher (app/api/cron/daily) and also callable directly.
import { NextResponse } from 'next/server'
import { getTokenStatus, refreshAccessToken } from '@/lib/social/instagram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = await getTokenStatus()
  if (!status.present) {
    return NextResponse.json({ skipped: 'no token stored' })
  }
  if (status.daysLeft !== null && status.daysLeft > 20) {
    return NextResponse.json({ skipped: `token healthy, ${status.daysLeft} days left` })
  }
  try {
    const result = await refreshAccessToken()
    return NextResponse.json({ refreshed: true, expiresIn: result.expiresIn })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'refresh failed' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { SeoConfigError } from '@/lib/seo/google-auth'
import { parseRange, rangeDates } from '@/lib/seo/range'
import { getCached } from '@/lib/seo/cache'
import { getSessionsOverTime, getTrafficBySourceMedium, getTopLandingPages, getAiAssistantTraffic } from '@/lib/seo/ga4-data'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// GA4 data for the SEO dashboard. Admin-only. Returns a friendly { error }
// (HTTP 200) for missing-config / access-denied so the UI can show a helpful
// message instead of a hard failure.
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const range = parseRange(new URL(req.url).searchParams.get('range'))
  const { startDate, endDate } = rangeDates(range)

  try {
    const data = await getCached(`analytics:${range}`, async () => {
      const [sessions, sources, landingPages, aiReferrals] = await Promise.all([
        getSessionsOverTime(startDate, endDate),
        getTrafficBySourceMedium(startDate, endDate),
        getTopLandingPages(startDate, endDate),
        getAiAssistantTraffic(startDate, endDate),
      ])
      return { sessions, sources, landingPages, aiReferrals, range, startDate, endDate }
    })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof SeoConfigError) {
      return NextResponse.json({ error: err.message, configured: false })
    }
    console.error('SEO analytics error:', err)
    return NextResponse.json({ error: 'Failed to load Analytics data. Please try again.' }, { status: 500 })
  }
}

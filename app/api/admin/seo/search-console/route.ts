import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { SeoConfigError } from '@/lib/seo/google-auth'
import { parseRange, rangeDates } from '@/lib/seo/range'
import { getCached } from '@/lib/seo/cache'
import { getTotals, getTimeSeries, getTopQueries, getTopPages } from '@/lib/seo/search-console'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Search Console data for the SEO dashboard. Admin-only. Returns a friendly
// { error } (HTTP 200) for missing-config / access-denied so the UI can show a
// helpful message instead of a hard failure.
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const range = parseRange(new URL(req.url).searchParams.get('range'))
  const { startDate, endDate } = rangeDates(range)

  try {
    const data = await getCached(`search-console:${range}`, async () => {
      const [totals, timeSeries, topQueries, topPages] = await Promise.all([
        getTotals(startDate, endDate),
        getTimeSeries(startDate, endDate),
        getTopQueries(startDate, endDate),
        getTopPages(startDate, endDate),
      ])
      return { totals, timeSeries, topQueries, topPages, range, startDate, endDate }
    })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof SeoConfigError) {
      return NextResponse.json({ error: err.message, configured: false })
    }
    console.error('SEO search-console error:', err)
    return NextResponse.json({ error: 'Failed to load Search Console data. Please try again.' }, { status: 500 })
  }
}

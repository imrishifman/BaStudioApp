import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { SeoConfigError } from '@/lib/seo/google-auth'
import { getRealtimeActiveUsers } from '@/lib/seo/ga4-data'

export const runtime = 'nodejs'
export const maxDuration = 20
export const dynamic = 'force-dynamic'

// Live "visitors right now" from the GA4 Realtime API. Admin-only. Never cached
// (the whole point is that it is live). Returns a friendly { error } at HTTP 200
// for missing-config / access-denied so the widget can degrade quietly.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const data = await getRealtimeActiveUsers()
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof SeoConfigError) {
      return NextResponse.json({ error: err.message, configured: false })
    }
    console.error('SEO realtime error:', err)
    return NextResponse.json({ error: 'Failed to load realtime data.' }, { status: 500 })
  }
}

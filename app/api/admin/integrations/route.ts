import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { getIntegrations } from '@/lib/integrations/status'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Third-party connection + token status for the admin Integrations view.
// Admin-only. Returns presence/validity/expiry, never any secret value.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const integrations = await getIntegrations()
    return NextResponse.json({ integrations, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Integrations status error:', err)
    return NextResponse.json({ error: 'Failed to load integration status.' }, { status: 500 })
  }
}

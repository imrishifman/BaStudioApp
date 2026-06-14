// Admin-only: store and check the Instagram access token.
// Seed once (POST the 60-day token you saved). The token never travels through
// chat or logs; you paste it here and it is stored in the SocialToken table.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { getTokenStatus, setAccessToken, verifyConnection } from '@/lib/social/instagram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const status = await getTokenStatus()
  let connection: unknown = null
  if (status.present) {
    try {
      connection = await verifyConnection()
    } catch (e) {
      connection = { error: e instanceof Error ? e.message : 'failed' }
    }
  }
  return NextResponse.json({ ...status, connection })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    token?: string
    expiresInSeconds?: number
  }
  if (typeof body.token !== 'string' || body.token.length < 20) {
    return NextResponse.json({ error: 'Provide a valid token' }, { status: 400 })
  }
  const result = await setAccessToken(body.token, body.expiresInSeconds)
  let connection: unknown = null
  try {
    connection = await verifyConnection()
  } catch (e) {
    connection = { error: e instanceof Error ? e.message : 'failed' }
  }
  return NextResponse.json({ ...result, connection })
}

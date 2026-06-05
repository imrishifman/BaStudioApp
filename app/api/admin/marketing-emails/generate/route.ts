// Admin-gated "Generate now" trigger. Hits the same shared generator the cron
// uses, so behavior is identical. Defaults to producing one draft per cohort
// (FREE, SOLO, MASTER) when no body is supplied.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { generateCampaignForAudience, type GenAudience } from '@/lib/email/generate'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  audiences: z.array(z.enum(['FREE', 'SOLO', 'MASTER'])).min(1).optional(),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let parsed: { audiences?: GenAudience[] } = {}
  try {
    const raw = await req.json().catch(() => ({}))
    parsed = bodySchema.parse(raw)
  } catch {
    // Empty body or unparseable body: fall through to the default cohort set.
  }
  const audiences: GenAudience[] = parsed.audiences ?? ['FREE', 'SOLO', 'MASTER']

  // Run all three in parallel - they're independent network calls.
  const settled = await Promise.all(
    audiences.map(async (aud) => {
      const out = await generateCampaignForAudience(aud)
      return { audience: aud, ...out }
    }),
  )

  return NextResponse.json({ ok: true, results: settled })
}

// Sunday 12:00 UTC heartbeat. For each audience, generate one AI draft only
// if there isn't already a DRAFT pending for that audience. This keeps the
// queue topped up without stacking duplicates when the per-send refill
// already covers normal cadence.

import { NextResponse } from 'next/server'
import { generateCampaignForAudience, hasPendingDraft, type GenAudience } from '@/lib/email/generate'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const audiences: GenAudience[] = ['FREE', 'SOLO', 'MASTER']
  const results: Record<GenAudience, { campaignId?: string; skipped?: true; error?: string }> = {
    FREE: {}, SOLO: {}, MASTER: {},
  }

  for (const audience of audiences) {
    if (await hasPendingDraft(audience)) {
      results[audience] = { skipped: true }
      continue
    }
    const out = await generateCampaignForAudience(audience)
    results[audience] = out
  }

  return NextResponse.json({ ok: true, results })
}

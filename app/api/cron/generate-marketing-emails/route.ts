// Vercel cron worker. Runs Sunday 12:00 UTC to draft next week's marketing
// emails with Claude. One campaign per audience (FREE, SOLO, MASTER), all
// inserted with needsReview=true so the admin must click Approve before the
// send cron (Mon/Wed/Fri 14:00 UTC) ships them.
//
// Auth: same CRON_SECRET as the send worker.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { extractJson } from '@/lib/ai/json'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type Audience = 'FREE' | 'SOLO' | 'MASTER'

// Brief = the same writing rules an external agent would use. We give Claude
// the full brand voice, structure, and constraints so it can produce something
// usable without follow-up. The audience and "recent subjects to avoid" come
// from the user prompt per-call.
const SYSTEM_BRIEF = `You are a marketing copywriter for Ba Studio, an AI podcast production app.

Voice: confident, calm, useful. Sounds like a smart producer, not a marketer. One idea per email. Plain English. No buzzwords. Sentences under 20 words when possible.

Hard rules:
- NEVER use em dashes (—) or en dashes (–). Use commas, periods, or parentheses.
- NEVER use placeholders like {firstName}. Write copy that reads well without personalization.
- All links must be full https://bastudiopodcast.com/... URLs. Never link off-site.
- Subject under 60 chars. Preheader under 110 chars. Body 80 to 180 words.
- Exactly one primary CTA button.

Body HTML rules:
- Allowed tags: <p>, <h2>, <strong>, <a>, <ul>, <li>.
- NO <style> blocks, <img>, <table> layouts, JavaScript, or external CSS.
- The branded shell (header, dark theme, unsubscribe footer) is added automatically. You write only the inner content.
- The CTA button should use this exact pattern, only the href + label change:
  <p style="margin:24px 0;"><a href="https://bastudiopodcast.com/STUDIO_PATH" style="display:inline-block;padding:12px 22px;background:#eaeaf0;color:#0b0b0f;text-decoration:none;border-radius:999px;font-weight:600;">CTA LABEL</a></p>

Useful Ba Studio URLs:
- Main app: https://bastudiopodcast.com/studio
- New episode wizard: https://bastudiopodcast.com/episodes/new
- Shows: https://bastudiopodcast.com/shows
- Guests: https://bastudiopodcast.com/guests
- Pricing / upgrade: https://bastudiopodcast.com/pricing
- Billing: https://bastudiopodcast.com/account/billing

Output: a single JSON object, no preamble, no fences, with exactly these keys:
{
  "subject": "...",
  "preheader": "...",
  "html": "..."
}`

// Goal per audience tier. Drives angle, CTA choice, and topic selection.
const AUDIENCE_GOAL: Record<Audience, string> = {
  FREE: 'Goal: convert this free user to a paid plan. Show what they hit on the free plan (1 episode, 1 show) and what paid unlocks (more episodes, Show DNA, calendar sync). Push them toward https://bastudiopodcast.com/pricing OR a feature page that demonstrates the value gap.',
  SOLO: 'Goal: engagement + retention for a paying solo creator. Surface a deeper feature, a power-user tip, or a workflow they probably haven\'t tried. Optional secondary nudge toward Master if it fits.',
  MASTER: 'Goal: retention + advocacy. Surface a power feature or a tip that shows you respect their level. Welcome feedback. Keep it short and high-signal.',
}

async function generateOne(client: Anthropic, audience: Audience, avoidSubjects: string[]): Promise<{ subject: string; preheader: string; html: string } | null> {
  const avoid = avoidSubjects.length
    ? `\n\nRecent subject lines for this audience (avoid repeating these themes):\n${avoidSubjects.map((s) => `- ${s}`).join('\n')}`
    : ''

  const userPrompt = `Write one marketing email for the audience: ${audience}.

${AUDIENCE_GOAL[audience]}${avoid}

Return the JSON object only.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: SYSTEM_BRIEF,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  if (!text) return null

  try {
    const parsed = extractJson<{ subject?: string; preheader?: string; html?: string }>(text)
    if (!parsed.subject || !parsed.html) return null
    // Defensive cleanup: strip em/en dashes if the model slipped any in.
    const clean = (s: string) => s.replace(/[—–]/g, ',')
    return {
      subject: clean(parsed.subject).trim().slice(0, 200),
      preheader: clean(parsed.preheader ?? '').trim().slice(0, 200),
      html: clean(parsed.html).trim(),
    }
  } catch (err) {
    console.error(`Could not parse JSON from Claude for ${audience}:`, err)
    return null
  }
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic()
  const audiences: Audience[] = ['FREE', 'SOLO', 'MASTER']

  // Pull the last six sent subjects per audience so Claude doesn't recycle
  // last week's angle. Six = roughly two weeks of cadence.
  const recentByAudience = await Promise.all(
    audiences.map(async (aud) => {
      const recent = await prisma.marketingEmailCampaign.findMany({
        where: { audience: aud, status: 'SENT' },
        orderBy: { sentAt: 'desc' },
        take: 6,
        select: { subject: true },
      })
      return { audience: aud, subjects: recent.map((r) => r.subject) }
    }),
  )

  const results: { audience: Audience; campaignId?: string; error?: string }[] = []

  for (const { audience, subjects } of recentByAudience) {
    try {
      const draft = await generateOne(client, audience, subjects)
      if (!draft) {
        results.push({ audience, error: 'Empty or unparseable model output' })
        continue
      }
      const created = await prisma.marketingEmailCampaign.create({
        data: {
          subject: draft.subject,
          preheader: draft.preheader || null,
          html: draft.html,
          audience,
          // Mark for review so the send cron skips until an admin approves.
          needsReview: true,
          createdByEmail: 'ai@bastudiopodcast.com',
        },
      })
      results.push({ audience, campaignId: created.id })
    } catch (err) {
      console.error(`Generation failed for ${audience}:`, err)
      results.push({ audience, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ ok: true, generated: results })
}

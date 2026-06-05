// Shared AI marketing-email generator.
//
// One implementation, three callers:
//   - Sunday cron (seed the queue when empty)
//   - Send cron (refill the same audience right after a send)
//   - Admin "Generate now" button (manual top-up)
//
// Output is always a DRAFT campaign with needsReview=true, so a fresh AI
// write can never ship without an admin clicking Approve in the UI.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { extractJson } from '@/lib/ai/json'

export type GenAudience = 'FREE' | 'SOLO' | 'MASTER'

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

const AUDIENCE_GOAL: Record<GenAudience, string> = {
  FREE: 'Goal: convert this free user to a paid plan. Show what they hit on the free plan (1 episode, 1 show) and what paid unlocks (more episodes, Show DNA, calendar sync). Push them toward https://bastudiopodcast.com/pricing OR a feature page that demonstrates the value gap.',
  SOLO: 'Goal: engagement + retention for a paying solo creator. Surface a deeper feature, a power-user tip, or a workflow they probably have not tried. Optional secondary nudge toward Master if it fits.',
  MASTER: 'Goal: retention + advocacy. Surface a power feature or a tip that shows you respect their level. Welcome feedback. Keep it short and high-signal.',
}

// Generate one AI campaign for the audience, insert as DRAFT + needsReview, and
// return its id. Returns { error } on failure so callers can decide whether to
// retry, log, or move on (a single audience failing should never block others).
export async function generateCampaignForAudience(
  audience: GenAudience,
): Promise<{ campaignId: string } | { error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'ANTHROPIC_API_KEY not configured' }
  }

  // Last six sent subjects keep Claude from recycling recent themes.
  const recent = await prisma.marketingEmailCampaign.findMany({
    where: { audience, status: 'SENT' },
    orderBy: { sentAt: 'desc' },
    take: 6,
    select: { subject: true },
  })

  const avoid = recent.length
    ? `\n\nRecent subject lines for this audience (avoid repeating these themes):\n${recent.map((r) => `- ${r.subject}`).join('\n')}`
    : ''

  const userPrompt = `Write one marketing email for the audience: ${audience}.

${AUDIENCE_GOAL[audience]}${avoid}

Return the JSON object only.`

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: SYSTEM_BRIEF,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!text) return { error: 'Empty model output' }

    const parsed = extractJson<{ subject?: string; preheader?: string; html?: string }>(text)
    if (!parsed.subject || !parsed.html) {
      return { error: 'Missing subject or html in model output' }
    }

    // Defensive: strip any em or en dashes the model snuck in.
    const clean = (s: string) => s.replace(/[—–]/g, ',')

    const created = await prisma.marketingEmailCampaign.create({
      data: {
        subject: clean(parsed.subject).trim().slice(0, 200),
        preheader: parsed.preheader ? clean(parsed.preheader).trim().slice(0, 200) : null,
        html: clean(parsed.html).trim(),
        audience,
        needsReview: true,
        createdByEmail: 'ai@bastudiopodcast.com',
      },
    })
    return { campaignId: created.id }
  } catch (err) {
    console.error(`Generation failed for ${audience}:`, err)
    return { error: err instanceof Error ? err.message : 'Unknown generation error' }
  }
}

// Whether the audience already has at least one DRAFT in the queue (either
// awaiting review or approved). The Sunday cron uses this to avoid stacking
// duplicates on an audience that already has unsent drafts.
export async function hasPendingDraft(audience: GenAudience): Promise<boolean> {
  const count = await prisma.marketingEmailCampaign.count({
    where: { audience, status: 'DRAFT' },
  })
  return count > 0
}

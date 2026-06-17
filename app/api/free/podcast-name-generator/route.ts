import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Public (no-auth) endpoint behind the free AI podcast name generator. It is an
// organic-acquisition funnel: anyone can use it, then signs up for the full
// product. Cost is bounded by a tight token cap + a per-IP soft rate limit.

const MAX_INPUT = 400
const PER_IP_PER_HOUR = 12

const SYSTEM = `You are a brand-naming expert for podcasts. Given a short description of a podcast, invent creative, memorable, brandable show names.

Return ONLY a JSON object of this exact shape:
{"names":[{"name":"Show Name","why":"one short reason"}]}

Rules:
- Exactly 12 names.
- Each name is 1 to 4 words, easy to say and spell.
- Mix the styles: some literal, some evocative, some playful, some single-word.
- Avoid the word "Podcast" unless it is genuinely clever.
- "why" is one short sentence, 12 words or fewer, on the angle of the name.
- No emojis, no numbering, no quotation marks inside names, and no dashes of any kind.`

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'The name generator is temporarily unavailable.' }, { status: 503 })
  }

  const rl = rateLimit(`png:${clientIp(req)}`, PER_IP_PER_HOUR, 60 * 60 * 1000)
  if (!rl.ok) {
    const mins = Math.max(1, Math.ceil(rl.retryAfterSec / 60))
    return NextResponse.json(
      { error: `You have hit the free limit. Try again in about ${mins} minute${mins === 1 ? '' : 's'}, or create a free Ba Studio account for unlimited names.` },
      { status: 429 },
    )
  }

  let description = ''
  try {
    const body = await req.json()
    description = String(body?.description ?? '').slice(0, MAX_INPUT).trim()
  } catch {
    /* fall through to validation */
  }
  if (description.length < 3) {
    return NextResponse.json({ error: 'Tell us a little about your podcast first (topic, vibe, audience).' }, { status: 400 })
  }

  try {
    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Podcast description: ${description}\n\nReturn the JSON now.` }],
    })
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
    const parsed = extractJson<{ names?: { name?: string; why?: string }[] }>(text)
    const names = (parsed.names ?? [])
      .filter((n): n is { name: string; why?: string } => !!n && typeof n.name === 'string' && n.name.trim().length > 0)
      .slice(0, 12)
      .map((n) => ({ name: n.name.trim(), why: typeof n.why === 'string' ? n.why.trim() : '' }))
    if (names.length === 0) {
      return NextResponse.json({ error: 'Could not generate names this time. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ names })
  } catch (err) {
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

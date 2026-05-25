import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

// Web-searches for a directly-loadable guest headshot URL. Returns null rather
// than a guess if nothing solid is found.
export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { guestName } = await req.json()
  if (!guestName?.trim()) return NextResponse.json({ error: 'guestName required' }, { status: 400 })

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [
        {
          role: 'user',
          content: `Find ONE direct, public, professional photo URL for ${guestName} — a link that ends in .jpg, .jpeg, .png, or .webp, from Wikipedia/Wikimedia, a news site, or an official source. Use web_search. Return JSON: {"photoUrl":"https://...jpg"} or {"photoUrl":null} if you cannot find a directly-loadable image. Do not invent URLs.`,
        },
      ],
    })
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
    let photoUrl: string | null = null
    try {
      photoUrl = extractJson<{ photoUrl?: string | null }>(text).photoUrl ?? null
    } catch {
      photoUrl = null
    }
    const ok = photoUrl && /^https?:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(photoUrl)
    return NextResponse.json({ photoUrl: ok ? photoUrl : null })
  } catch (err) {
    console.error('Photo AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

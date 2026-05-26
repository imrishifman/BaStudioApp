import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildShowFromUrlPrompt } from '@/lib/ai/prompts'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

interface UrlShowResult {
  show_name?: string | null
  host_name?: string | null
  vibe?: string
  full_profile?: string
}

// Web-searches a podcast URL, extracts a structured style profile, and stores
// it on the episode under influenceProfiles[Show Name (Host)]. Returns the
// profile so the client can create a custom card.
export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, url } = await req.json()
  if (!episodeId || !url?.trim()) {
    return NextResponse.json({ error: 'episodeId and url required' }, { status: 400 })
  }

  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, createdByEmail: session.user.email },
    select: { id: true, influenceProfiles: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: buildShowFromUrlPrompt(url.trim()) }],
    })
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim()
    const data = extractJson<UrlShowResult>(text)

    if (!data.show_name) return NextResponse.json({ found: false })

    const key = data.host_name ? `${data.show_name} (${data.host_name})` : data.show_name
    const existing = (episode.influenceProfiles as Record<string, string> | null) ?? {}
    const next = { ...existing, [key]: data.full_profile ?? '' }
    await prisma.episode.update({
      where: { id: episodeId },
      data: { influenceProfiles: next as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({
      found: true,
      name: key,
      vibe: data.vibe ?? '',
      profile: data.full_profile ?? '',
    })
  } catch (err) {
    console.error('Influencer-from-url error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

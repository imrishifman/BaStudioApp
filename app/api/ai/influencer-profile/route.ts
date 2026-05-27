import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildInfluencerProfilePrompt } from '@/lib/ai/prompts'
import { aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

// Generates a 7-dimension interviewer style profile for a named influencer and
// stores it on the episode under influenceProfiles[name].
export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, name } = await req.json()
  if (!episodeId || !name?.trim()) {
    return NextResponse.json({ error: 'episodeId and name required' }, { status: 400 })
  }

  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, createdByEmail: session.user.email },
    select: { id: true, influenceProfiles: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: buildInfluencerProfilePrompt(name.trim()) }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    if (!text) throw new Error('Empty profile')

    const existing = (episode.influenceProfiles as Record<string, string> | null) ?? {}
    const next = { ...existing, [name.trim()]: text }
    await prisma.episode.update({
      where: { id: episodeId },
      data: { influenceProfiles: next as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({ name: name.trim(), profile: text })
  } catch (err) {
    console.error('Influencer profile error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildScriptPrompt } from '@/lib/ai/prompts'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, showId, kind = 'full' } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const show = showId ? await prisma.show.findUnique({ where: { id: showId } }) : null
  const prompt = buildScriptPrompt(episode, show, kind)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: kind === 'full' ? 6000 : 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid response' }, { status: 500 })

    const { script } = JSON.parse(jsonMatch[0])

    const updateData = kind === 'intro'
      ? { introductionScript: script, status: 'script' as const }
      : { fullScript: script, status: 'review' as const }

    await prisma.episode.update({ where: { id: episodeId }, data: updateData })

    return NextResponse.json({ script })
  } catch (err) {
    console.error('Script AI error:', err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}

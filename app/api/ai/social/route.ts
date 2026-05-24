import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildSocialPrompt } from '@/lib/ai/prompts'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, showId, releaseDate } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const show = showId ? await prisma.show.findUnique({ where: { id: showId } }) : null
  const prompt = buildSocialPrompt(episode, show, releaseDate)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const data = extractJson(text)
    await prisma.episode.update({ where: { id: episodeId }, data: { socialContent: data as Prisma.InputJsonValue } })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Social AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

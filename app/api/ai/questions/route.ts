import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildQuestionsPrompt } from '@/lib/ai/prompts'
import { resolveSections, normalizeGenerated } from '@/lib/questions'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, showId, focusAnswers, influences } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const show = showId ? await prisma.show.findUnique({ where: { id: showId } }) : null

  // Section structure: Podcast DNA → default.
  const sections = resolveSections(show?.episodeSections, null)

  // Previous questions (any shape) so the AI avoids repeats.
  const prevEpisodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email, id: { not: episodeId } },
    select: { generatedQuestions: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })
  const prevQs = prevEpisodes.flatMap(ep => {
    const { map } = normalizeGenerated(ep.generatedQuestions)
    return Object.values(map).flat().map(q => q.question)
  })

  const profiles = (episode.influenceProfiles as Record<string, string> | null) ?? {}
  const prompt = buildQuestionsPrompt(
    { ...episode, focusAnswers: focusAnswers ?? episode.focusAnswers },
    show,
    sections,
    prevQs,
    Array.isArray(influences) ? influences : (episode.interviewInfluences ?? []),
    profiles
  )

  try {
    const message = await anthropic.messages.create({
      // Haiku is 2-3x faster than Sonnet — needed to fit the 60s function limit
      // while generating 30 questions with context + go-deeper, and influence
      // profiles in the prompt.
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = extractJson<Record<string, unknown>>(text)
    // Store the sectioned object plus the resolved section metadata.
    const generated = { ...parsed, _sections: sections }

    await prisma.episode.update({
      where: { id: episodeId },
      data: { generatedQuestions: generated as unknown as Prisma.InputJsonValue, status: 'questions' },
    })

    return NextResponse.json({ questions: generated })
  } catch (err) {
    console.error('Questions AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

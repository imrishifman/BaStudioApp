import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildQuestionsPrompt } from '@/lib/ai/prompts'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, showId, focusAnswers } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const show = showId ? await prisma.show.findUnique({ where: { id: showId } }) : null

  // Get questions from previous episodes for repeat detection
  const prevEpisodes = await prisma.episode.findMany({
    where: { createdByEmail: session.user.email, id: { not: episodeId } },
    select: { generatedQuestions: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })
  const prevQs = prevEpisodes.flatMap(ep => {
    const qs = ep.generatedQuestions as { text: string }[] | null
    return qs?.map(q => q.text) ?? []
  })

  const prompt = buildQuestionsPrompt(
    { ...episode, focusAnswers: focusAnswers ?? episode.focusAnswers },
    show,
    prevQs
  )

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid response' }, { status: 500 })

    const data = JSON.parse(jsonMatch[0])
    const questions = data.questions ?? []

    await prisma.episode.update({ where: { id: episodeId }, data: { generatedQuestions: questions, status: 'questions' } })

    return NextResponse.json({ questions })
  } catch (err) {
    console.error('Questions AI error:', err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}

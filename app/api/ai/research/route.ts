import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildResearchPrompt } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, guestName, links, mode = 'initial' } = await req.json()

  // Plan limits — free plan: 1 research call ever
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.plan === 'free' && user.aiResearchCountThisMonth >= 1) {
    return NextResponse.json({ error: 'Research limit reached. Upgrade to continue.' }, { status: 403 })
  }

  let show = null
  if (episodeId) {
    const ep = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
    if (ep?.showId) show = await prisma.show.findUnique({ where: { id: ep.showId } })
  }

  const prompt = buildResearchPrompt(guestName, links ?? [], null, mode, show)

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })

    const data = JSON.parse(jsonMatch[0])

    // Save to episode + increment counter
    if (episodeId) {
      await prisma.episode.updateMany({
        where: { id: episodeId, createdByEmail: session.user.email },
        data: {
          guestBio: data.bio,
          guestResearch: data.research,
          funFacts: data.funFacts ?? [],
          guestPhotoUrl: data.photoUrl ?? undefined,
        },
      })
    }
    await prisma.user.update({ where: { email: session.user.email }, data: { aiResearchCountThisMonth: { increment: 1 } } })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Research AI error:', err)
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}

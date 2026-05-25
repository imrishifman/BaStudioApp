import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildResearchPrompt, buildBioPrompt, buildFunFactsPrompt } from '@/lib/ai/prompts'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'
import { ensureGuestFromEpisode } from '@/lib/guest-sync'

// Web-search research + two follow-up calls can take a while.
export const maxDuration = 60

// Concatenate the text blocks of a message (web-search responses also include
// server_tool_use / web_search_tool_result blocks we ignore).
function allText(message: Anthropic.Message): string {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim()
}

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, guestName, mode = 'initial' } = await req.json()

  // Plan limits — free plan: 1 research call ever
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.plan === 'free' && user.aiResearchCountThisMonth >= 1) {
    return NextResponse.json({ error: 'Research limit reached. Upgrade to continue.' }, { status: 403 })
  }

  // Pull the guest's links + context + show DNA straight from the episode.
  let show = null
  let extraContext: string | null = null
  let links: string[] = []
  const ep = episodeId
    ? await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
    : null
  if (ep) {
    extraContext = ep.guestExtraContext ?? null
    links = [ep.guestLinkedinUrl, ep.guestTwitterUrl, ep.guestInstagramUrl, ep.guestWebsiteUrl].filter(
      (l): l is string => !!l
    )
    if (ep.showId) show = await prisma.show.findUnique({ where: { id: ep.showId } })
  }

  try {
    // Call 1 — deep research with live web search (primary sources first).
    const researchMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: mode === 'deep' ? 8 : 5 }],
      messages: [{ role: 'user', content: buildResearchPrompt(guestName, links, extraContext, mode, show) }],
    })
    const research = allText(researchMsg)
    if (!research) throw new Error('No research could be produced')

    // Persist the brief immediately so it isn't lost if a later call fails.
    if (episodeId) {
      await prisma.episode.updateMany({
        where: { id: episodeId, createdByEmail: session.user.email },
        data: { guestResearch: research },
      })
    }

    // Calls 2 & 3 — bio + fun facts, in parallel, from the verified research.
    const [bioMsg, factsMsg] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildBioPrompt(research, guestName, show) }],
      }),
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: buildFunFactsPrompt(research, guestName) }],
      }),
    ])
    const bio = allText(bioMsg)
    let funFacts: string[] = []
    try {
      funFacts = extractJson<{ facts?: string[] }>(allText(factsMsg)).facts ?? []
    } catch {
      funFacts = []
    }

    if (episodeId) {
      const updated = await prisma.episode.update({
        where: { id: episodeId },
        data: { guestBio: bio, funFacts },
      })
      // Guest CRM side-effect: create/link the guest as confirmed.
      await ensureGuestFromEpisode(session.user.email, updated)
    }
    await prisma.user.update({
      where: { email: session.user.email },
      data: { aiResearchCountThisMonth: { increment: 1 } },
    })

    return NextResponse.json({ bio, research, funFacts })
  } catch (err) {
    console.error('Research AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

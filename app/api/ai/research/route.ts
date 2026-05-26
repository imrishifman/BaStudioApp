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

  // Plan limits — free plan: 1 research call ever (skip for the lightweight bio regen)
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (mode !== 'regenerate-bio' && user.plan === 'free' && user.aiResearchCountThisMonth >= 1) {
    return NextResponse.json({ error: 'Research limit reached. Upgrade to continue.' }, { status: 403 })
  }

  // Pull the guest's links + context + show DNA straight from the episode.
  let show = null
  let extraContext: string | null = null
  const ep = episodeId
    ? await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
    : null
  const socialLinks = {
    linkedin: ep?.guestLinkedinUrl ?? null,
    twitter: ep?.guestTwitterUrl ?? null,
    instagram: ep?.guestInstagramUrl ?? null,
    website: ep?.guestWebsiteUrl ?? null,
  }
  if (ep) {
    extraContext = ep.guestExtraContext ?? null
    if (ep.showId) show = await prisma.show.findUnique({ where: { id: ep.showId } })
  }

  try {
    // Lightweight path: just regenerate a punchier bio from existing research.
    if (mode === 'regenerate-bio') {
      const existing = ep?.guestResearch ?? ''
      const bioMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildBioPrompt(existing, guestName, show, { punchy: true }) }],
      })
      const bio = allText(bioMsg)
      if (episodeId) await prisma.episode.updateMany({ where: { id: episodeId, createdByEmail: session.user.email }, data: { guestBio: bio } })
      return NextResponse.json({ bio })
    }

    const isDeep = mode === 'deep'
    // Call 1 — research with live web search. Deep mode finds ONLY new info.
    const researchMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: isDeep ? 4 : 3 }],
      messages: [{ role: 'user', content: buildResearchPrompt({
        guestName,
        socialLinks,
        knownBio: null,
        extraContext,
        mode,
        show,
        existingResearch: isDeep ? ep?.guestResearch ?? null : null,
      }) }],
    })
    const newResearch = allText(researchMsg)
    if (!newResearch) throw new Error('No research could be produced')
    // Deep mode appends to the existing brief; initial replaces it.
    const research = isDeep && ep?.guestResearch
      ? `${ep.guestResearch}\n\n---\n## Deep research (additional findings)\n${newResearch}`
      : newResearch

    if (episodeId) {
      await prisma.episode.updateMany({
        where: { id: episodeId, createdByEmail: session.user.email },
        data: { guestResearch: research },
      })
    }

    // Calls 2 & 3 — bio + fun facts in parallel. Deep mode = richer bio + 10 facts.
    const [bioMsg, factsMsg] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: isDeep ? 600 : 400,
        messages: [{ role: 'user', content: buildBioPrompt(research, guestName, show, isDeep ? { sentences: '4-5' } : {}) }],
      }),
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isDeep ? 900 : 600,
        messages: [{ role: 'user', content: buildFunFactsPrompt(research, guestName, isDeep ? 10 : 5, { specific: isDeep }) }],
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

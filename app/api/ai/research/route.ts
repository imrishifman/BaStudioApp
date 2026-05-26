import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildResearchPrompt, buildBioPrompt, buildFunFactsPrompt } from '@/lib/ai/prompts'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'
import { ensureGuestFromEpisode } from '@/lib/guest-sync'

// Each phase is its own serverless invocation, so each call fits in 60s even
// when the deep research includes web search.
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

/**
 * The research route is split into phases so each phase fits comfortably under
 * the 60s function limit:
 *
 *  - phase 'research' (default) + mode 'initial' | 'deep': runs the web-search
 *    research and saves guestResearch. Returns { research }. NO bio/facts here.
 *  - phase 'derive': uses the existing guestResearch to write bio + fun facts
 *    in parallel. Returns { bio, funFacts }.
 *  - mode 'regenerate-bio': lightweight bio re-write from existing research.
 *
 * The client (Step 2) calls research → derive in sequence, behind one overlay.
 */
export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, guestName, mode = 'initial', phase = 'research' } = await req.json()

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  // Free-plan research limit only counts the heavy research phase.
  if (phase === 'research' && mode !== 'regenerate-bio' && user.plan === 'free' && user.aiResearchCountThisMonth >= 1) {
    return NextResponse.json({ error: 'Research limit reached. Upgrade to continue.' }, { status: 403 })
  }

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
    // ── Lightweight: just regenerate a punchier bio from existing research ──
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

    // ── Phase 'derive': bio + fun facts from already-saved research ──
    if (phase === 'derive') {
      const research = ep?.guestResearch ?? ''
      if (!research) return NextResponse.json({ error: 'No research to derive from' }, { status: 400 })
      const isDeep = mode === 'deep'
      const [bioMsg, factsMsg] = await Promise.all([
        // Bio on Haiku — faster, and bio is short; keeps the function well under 60s.
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
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
      } catch { funFacts = [] }
      if (episodeId) {
        const updated = await prisma.episode.update({ where: { id: episodeId }, data: { guestBio: bio, funFacts } })
        await ensureGuestFromEpisode(session.user.email, updated)
      }
      return NextResponse.json({ bio, funFacts })
    }

    // ── Phase 'research' (default): web-search research only ──
    const isDeep = mode === 'deep'
    const researchMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: isDeep ? 3000 : 3500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: isDeep ? 4 : 5 }],
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
    await prisma.user.update({
      where: { email: session.user.email },
      data: { aiResearchCountThisMonth: { increment: 1 } },
    })
    return NextResponse.json({ research })
  } catch (err) {
    console.error('Research AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

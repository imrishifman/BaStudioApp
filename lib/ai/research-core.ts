// Shared guest-research engine.
//
// The web `/api/ai/research` route uses Gemini 2.5 Flash with Google Search
// grounding (to read indexed LinkedIn / news / blog snippets the Anthropic
// web_search can't), then Claude Haiku to derive a tight bio + fun facts. This
// module wraps the same brain in a function that any caller (web route, the
// WhatsApp bot, future surfaces) can use without an HTTP auth session.
//
// Usage:
//   const { research, bio, funFacts } = await runFullGuestResearch({
//     userEmail, guestName, episodeId,
//   })
// The Episode row is updated in-place with guestResearch, guestBio, funFacts.

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/prisma'
import {
  buildResearchPrompt,
  buildResearchPrefix,
  buildBioInstruction,
  buildFunFactsInstruction,
  languageDirective,
} from '@/lib/ai/prompts'
import { extractJson } from '@/lib/ai/json'
import { cleanBio, cleanFacts, fallbackBio } from '@/lib/ai/sanitize'
import { enrichFromLinks } from '@/lib/ai/enrich'
import { ensureGuestFromEpisode } from '@/lib/guest-sync'

interface RunArgs {
  userEmail: string
  guestName: string
  episodeId?: string
}

interface RunResult {
  research: string
  bio: string
  funFacts: string[]
}

// Concatenate the text blocks of a Claude message (web-search responses can
// also include tool-use blocks we ignore).
function allText(message: Anthropic.Message): string {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim()
}

// Strip markdown headings, code fences, and asterisks for chat-friendly output.
export function plainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, '') // code fences
    .replace(/^#{1,6}\s+/gm, '')    // markdown headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/[—–]/g, ',')          // em/en dashes -> commas (house rule)
    .trim()
}

export async function runFullGuestResearch({ userEmail, guestName, episodeId }: RunArgs): Promise<RunResult> {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')

  // Pull the user's saved language (e.g. Hebrew) so the output matches their
  // preference, matching the web flow.
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { language: true, plan: true, aiResearchCountThisMonth: true },
  })
  const langSuffix = languageDirective(user?.language ?? 'en')

  // Enforce the free-plan research cap (same rule the web honours).
  if (user?.plan === 'free' && user.aiResearchCountThisMonth >= 1) {
    throw new Error('Research limit reached. Upgrade to Studio Solo for more research credits.')
  }

  // The Episode row (if we already have one) lets us pass any social links the
  // user already attached. From WhatsApp we usually don't yet, so links are
  // empty.
  const ep = episodeId
    ? await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: userEmail } })
    : null
  const socialLinks = {
    linkedin: ep?.guestLinkedinUrl ?? null,
    twitter: ep?.guestTwitterUrl ?? null,
    instagram: ep?.guestInstagramUrl ?? null,
    website: ep?.guestWebsiteUrl ?? null,
  }

  // ─── Phase 1: Gemini web-search research ────────────────────────────────
  const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
  // Read the pasted LinkedIn directly (when a provider key is configured) so the
  // brief is anchored to the REAL person, not a name-only guess. Fail-soft.
  const knownBio = await enrichFromLinks(socialLinks)
  const researchPrompt = buildResearchPrompt({
    guestName,
    socialLinks,
    knownBio,
    extraContext: ep?.guestExtraContext ?? null,
    mode: 'initial',
    show: null,
    existingResearch: null,
  })

  let geminiRes: Awaited<ReturnType<typeof genai.models.generateContent>> | null = null
  let lastErr: unknown = null
  // Small retry on transient 503/429 from Gemini.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      geminiRes = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: researchPrompt + langSuffix,
        config: {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 3500,
          temperature: 0.4,
        },
      })
      break
    } catch (e) {
      lastErr = e
      const status = (e as { status?: number })?.status
      if (status !== 503 && status !== 429) throw e
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
  if (!geminiRes) throw lastErr ?? new Error('Gemini call failed')

  const parts = geminiRes.candidates?.[0]?.content?.parts ?? []
  const research = parts.map((p) => p.text ?? '').join('').trim()
  if (!research) throw new Error('No research could be produced')

  // ─── Phase 2: Claude Haiku → bio + fun facts in parallel ───────────────
  const anthropic = new Anthropic()
  const prefix = buildResearchPrefix(research, guestName, ep?.guestExtraContext ?? null)
  const [bioMsg, factsMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: buildBioInstruction(guestName, null, {}) + langSuffix },
        ],
      }],
    }),
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: buildFunFactsInstruction(guestName, 5, {}) + langSuffix },
        ],
      }],
    }),
  ])

  const bio = cleanBio(allText(bioMsg)) || fallbackBio(guestName, ep?.guestExtraContext ?? null)
  let funFacts: string[] = []
  try {
    funFacts = cleanFacts(extractJson<{ facts?: string[] }>(allText(factsMsg)).facts ?? [])
  } catch {
    funFacts = []
  }

  // ─── Phase 3: persist back to Episode + sync to Guest ──────────────────
  if (episodeId) {
    const updated = await prisma.episode.update({
      where: { id: episodeId },
      data: {
        guestResearch: research,
        guestBio: bio,
        funFacts,
        currentStep: 3,
      },
    })
    await ensureGuestFromEpisode(userEmail, updated)
  }

  // Bump the user's monthly research counter (Free-plan limiter).
  await prisma.user.update({
    where: { email: userEmail },
    data: { aiResearchCountThisMonth: { increment: 1 } },
  })

  return { research, bio, funFacts }
}

// WhatsApp episode-prep conversation.
//
// Flow per phone number (commit 2/3 of the rebuild):
//
//   IDLE -> AWAITING_EMAIL
//     bot asks for Ba Studio email, links the chat to the user
//   AWAITING_EMAIL -> AWAITING_GUEST_NAME
//     "Who's the guest?"
//   AWAITING_GUEST_NAME -> RESEARCHING (deferred)
//     creates Episode + kicks off the SAME Gemini+Claude pipeline the web
//     uses (lib/ai/research-core). Sends a short bio + 3-5 fun facts.
//   RESEARCHING -> AWAITING_ANGLE
//     "What angle do you want? 1/2/3"
//   AWAITING_ANGLE -> GENERATING (deferred)
//     question generation uses the saved research blob as context
//     -> 10 tailored questions saved to the Episode
//     -> link to the saved /episodes/<id>
//
// Future commits add: combined angle+tone, intro+script generation, brief,
// and social promo. Every step updates the same Episode row.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'
import { runFullGuestResearch, plainText } from '@/lib/ai/research-core'

type AngleKey = 'business' | 'personal' | 'craft'
const ANGLES: Record<'1' | '2' | '3', { key: AngleKey; label: string }> = {
  '1': { key: 'business', label: 'Business' },
  '2': { key: 'personal', label: 'Personal story' },
  '3': { key: 'craft', label: 'Craft / expertise' },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const ASK_EMAIL =
  "Welcome to Ba Studio on WhatsApp.\n\nWhat's the email on your Ba Studio account? I'll link this chat to your account so the episode you create here saves automatically."

const ASK_GUEST_NAME =
  "You're in. Let's prep an episode.\n\nWho's the guest? Reply with their full name."

function askGuestLinks(name: string): string {
  return `Got it, ${name}.\n\nAny links so I can research the right person? Send their LinkedIn, Twitter/X, Instagram, or website (you can send several, just paste the URLs).\n\nReply 'skip' if you don't have any.`
}

// Parse free-text containing one or more URLs into the Episode's typed social
// slots (the same field names the web wizard uses).
function parseGuestLinks(text: string): {
  guestLinkedinUrl?: string
  guestTwitterUrl?: string
  guestInstagramUrl?: string
  guestWebsiteUrl?: string
} {
  const urlRegex = /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s]*)?/gi
  const matches = text.match(urlRegex) ?? []
  const out: {
    guestLinkedinUrl?: string
    guestTwitterUrl?: string
    guestInstagramUrl?: string
    guestWebsiteUrl?: string
  } = {}
  for (const raw of matches) {
    const normalized = raw.startsWith('http') ? raw : `https://${raw.replace(/^www\./i, '')}`
    const lower = normalized.toLowerCase()
    if (lower.includes('linkedin.com')) out.guestLinkedinUrl ??= normalized
    else if (lower.includes('twitter.com') || lower.includes('x.com/')) out.guestTwitterUrl ??= normalized
    else if (lower.includes('instagram.com')) out.guestInstagramUrl ??= normalized
    else if (!out.guestWebsiteUrl) out.guestWebsiteUrl = normalized
  }
  return out
}

function isSkip(input: string): boolean {
  const t = input.trim().toLowerCase()
  return t === 'skip' || t === 'none' || t === 'no' || t === 'no links' || t === 'n'
}

function askAngle(name: string): string {
  return `Now pick an angle for the episode with ${name}:\n1. Business\n2. Personal story\n3. Craft / expertise\n\nReply with 1, 2, or 3.`
}

function parseAngle(input: string): { key: AngleKey; label: string } | null {
  const trimmed = input.trim()
  if (trimmed === '1' || trimmed === '2' || trimmed === '3') return ANGLES[trimmed]
  const lower = trimmed.toLowerCase()
  if (lower.includes('business')) return ANGLES['1']
  if (lower.includes('personal') || lower.includes('story')) return ANGLES['2']
  if (lower.includes('craft') || lower.includes('expert')) return ANGLES['3']
  return null
}

function isRestart(input: string): boolean {
  const t = input.trim().toLowerCase()
  return t === 'restart' || t === 'reset' || t === 'start over' || t === 'cancel'
}

export interface ConversationStepResult {
  immediate: string
  deferredJob?: () => Promise<string>
}

export async function handleInboundMessage(
  phoneNumber: string,
  body: string,
): Promise<ConversationStepResult> {
  const text = body.trim()

  // Universal restart. Keeps the userEmail (no re-auth needed) but resets
  // the in-progress episode + guest data.
  if (isRestart(text)) {
    const existing = await prisma.whatsAppConversation.findUnique({ where: { phoneNumber } })
    if (existing?.userEmail) {
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: {
          step: 'AWAITING_GUEST_NAME',
          guestName: null,
          angle: null,
          episodeId: null,
        },
      })
      return { immediate: ASK_GUEST_NAME }
    }
    await prisma.whatsAppConversation.upsert({
      where: { phoneNumber },
      create: { phoneNumber, step: 'AWAITING_EMAIL' },
      update: {
        step: 'AWAITING_EMAIL',
        guestName: null,
        angle: null,
        episodeId: null,
      },
    })
    return { immediate: ASK_EMAIL }
  }

  const convo = await prisma.whatsAppConversation.upsert({
    where: { phoneNumber },
    create: { phoneNumber, step: 'IDLE' },
    update: {},
  })

  switch (convo.step) {
    case 'IDLE': {
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'AWAITING_EMAIL' },
      })
      return { immediate: ASK_EMAIL }
    }

    case 'AWAITING_EMAIL': {
      const email = text.toLowerCase()
      if (!EMAIL_RE.test(email)) {
        return {
          immediate:
            "That does not look like an email. Try again, for example you@example.com.\n\nOr reply 'restart' if you want to start over.",
        }
      }
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, fullName: true },
      })
      if (!user) {
        return {
          immediate: `No Ba Studio account found for ${email}.\n\nCreate one here, then come back and send your email again:\n${SITE_URL}/?signin=1`,
        }
      }
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'AWAITING_GUEST_NAME', userEmail: user.email },
      })
      const greeting = user.fullName ? `Hi ${user.fullName.split(' ')[0]}.` : 'You are linked.'
      return { immediate: `${greeting}\n\n${ASK_GUEST_NAME}` }
    }

    case 'AWAITING_GUEST_NAME': {
      if (text.length < 2 || text.length > 100) {
        return { immediate: "Please send the guest's name (just their name)." }
      }
      if (!convo.userEmail) {
        await prisma.whatsAppConversation.update({
          where: { phoneNumber },
          data: { step: 'AWAITING_EMAIL' },
        })
        return { immediate: ASK_EMAIL }
      }
      const guestName = text
      // Create the in-progress Episode now (without links yet) so the user
      // sees it on the web straight away.
      const episode = await prisma.episode.create({
        data: {
          guestName,
          createdByEmail: convo.userEmail,
          status: 'researching',
          currentStep: 1,
        },
      })
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: {
          step: 'AWAITING_GUEST_LINKS',
          guestName,
          episodeId: episode.id,
        },
      })
      return { immediate: askGuestLinks(guestName) }
    }

    case 'AWAITING_GUEST_LINKS': {
      if (!convo.userEmail || !convo.guestName || !convo.episodeId) {
        // Defensive: shouldn't happen, but reset cleanly.
        await prisma.whatsAppConversation.update({
          where: { phoneNumber },
          data: { step: 'AWAITING_EMAIL' },
        })
        return { immediate: ASK_EMAIL }
      }
      const userEmail = convo.userEmail
      const guestName = convo.guestName
      const episodeId = convo.episodeId

      const links = isSkip(text) ? {} : parseGuestLinks(text)
      // Save whatever the user gave us onto the Episode so subsequent steps
      // and the web UI can use them.
      if (Object.keys(links).length) {
        await prisma.episode.update({
          where: { id: episodeId },
          data: links,
        })
      }
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'GENERATING' },
      })

      const linksLine = Object.keys(links).length
        ? `Using ${Object.keys(links).length} link${Object.keys(links).length === 1 ? '' : 's'} you sent. `
        : 'No links, going off the name alone. '
      return {
        immediate: `${linksLine}Researching ${guestName} now (web search + bio + fun facts). Give me up to 60 seconds.`,
        deferredJob: async () => {
          try {
            const { bio, funFacts } = await runFullGuestResearch({
              userEmail,
              guestName,
              episodeId,
            })
            await prisma.whatsAppConversation.update({
              where: { phoneNumber },
              data: { step: 'AWAITING_ANGLE' },
            })
            const facts = (funFacts ?? []).slice(0, 5)
            const factsBlock = facts.length
              ? '\n\nFun facts:\n' + facts.map((f, i) => `${i + 1}. ${plainText(f)}`).join('\n')
              : ''
            const cleanBio = plainText(bio || '').slice(0, 600)
            return (
              `Here's what I found about ${guestName}:\n\n${cleanBio}${factsBlock}\n\n` +
              `Open the full research on the web:\n${SITE_URL}/episodes/${episodeId}\n\n` +
              askAngle(guestName)
            )
          } catch (err) {
            console.error('WhatsApp research job failed:', err)
            await prisma.whatsAppConversation.update({
              where: { phoneNumber },
              data: { step: 'AWAITING_ANGLE' },
            })
            const msg = err instanceof Error ? err.message : 'research failed'
            return `I hit a snag researching ${guestName} (${msg}).\n\nWe can still draft questions. ${askAngle(guestName)}`
          }
        },
      }
    }

    case 'AWAITING_ANGLE': {
      const angle = parseAngle(text)
      if (!angle) {
        return {
          immediate:
            "I didn't catch that. Reply with 1 (Business), 2 (Personal story), or 3 (Craft / expertise).",
        }
      }
      const guestName = convo.guestName ?? 'your guest'
      const episodeId = convo.episodeId
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'GENERATING', angle: angle.key },
      })
      return {
        immediate: `On it. Drafting 10 questions tailored to ${guestName} (${angle.label} angle). Give me about 20 seconds.`,
        deferredJob: async () => {
          // Pull the research we just saved so the questions are grounded in
          // the real person, not a generic stranger.
          const episode = episodeId
            ? await prisma.episode.findUnique({ where: { id: episodeId } })
            : null
          const research = (episode?.guestResearch ?? '').slice(0, 8000)
          const questions = await generateQuestions(guestName, angle.label, research)
          if (episodeId) {
            await prisma.episode.update({
              where: { id: episodeId },
              data: {
                generatedQuestions: questions.list,
                focusAnswers: { angle: angle.key, source: 'whatsapp' },
                currentStep: 5,
                status: 'questions',
              },
            })
          }
          await prisma.whatsAppConversation.update({
            where: { phoneNumber },
            data: { step: 'IDLE' },
          })
          const link = episodeId ? `\n\nOpen the saved episode on the web:\n${SITE_URL}/episodes/${episodeId}` : ''
          return `Here are 10 questions for ${guestName} (${angle.label} angle):\n\n${questions.text}${link}\n\nReply "restart" to prep another episode.`
        },
      }
    }

    case 'GENERATING': {
      return { immediate: "Still working on it. Sit tight." }
    }
  }
}

async function generateQuestions(
  guestName: string,
  angleLabel: string,
  research: string,
): Promise<{ text: string; list: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: '1. (AI not configured. Contact Ba Studio support.)', list: [] }
  }
  const client = new Anthropic()
  const researchBlock = research
    ? `\n\nResearch on the guest (use this to write specific, well-grounded questions, never generic):\n${research}`
    : ''
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system:
      'You are an expert podcast producer writing interview questions. Style: thoughtful, specific to THIS guest, designed to elicit detailed stories (not yes/no). Use concrete facts from the research wherever possible. Never use em dashes; use commas instead.',
    messages: [
      {
        role: 'user',
        content: `Write exactly 10 numbered interview questions (format "1. ...", "2. ...", etc) for a podcast guest named ${guestName}, with a ${angleLabel} angle.${researchBlock}\n\nReturn the numbered list only, with no preamble or closing remarks.`,
      },
    ],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  const list = text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 10)
  return { text: text || '1. (Could not generate questions. Try again.)', list }
}

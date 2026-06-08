// WhatsApp episode-prep conversation.
//
// Flow per phone number (kept simple for the MVP; the full 7-step flow lands
// in follow-up commits):
//
//   1. First message ever from this phone -> AWAITING_EMAIL
//        bot: "Welcome. What's your Ba Studio email?"
//   2. User sends email -> verify it matches a real Ba Studio user
//        match: linked, ask for guest name
//        no match: send signup link, stay in AWAITING_EMAIL
//   3. AWAITING_GUEST_NAME -> save name, create Episode draft tied to user,
//        ask for angle
//   4. AWAITING_ANGLE -> pick 1/2/3, kick off question generation
//   5. GENERATING (deferred): Claude writes 10 questions, saves to Episode,
//        sends them with a link to the saved draft on the web
//
// State is in WhatsAppConversation; each row also points to the in-progress
// Episode so subsequent steps (research, intro, script, brief, promo) can keep
// updating the same record as we add them.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'

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
  "You're in. Let's prep an episode.\n\nWho's the guest? Reply with their name."

function askAngle(name: string): string {
  return `Got it, ${name}.\n\nWhat angle do you want to take?\n1. Business\n2. Personal story\n3. Craft / expertise\n\nReply with 1, 2, or 3.`
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

  // Universal restart. Keeps the userEmail (no need to re-auth) but clears
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

  // Find-or-create the conversation row.
  const convo = await prisma.whatsAppConversation.upsert({
    where: { phoneNumber },
    create: { phoneNumber, step: 'IDLE' },
    update: {},
  })

  switch (convo.step) {
    case 'IDLE': {
      // First message ever. Send straight to email capture.
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
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true } })
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
        // Defensive: shouldn't happen, but recover gracefully.
        await prisma.whatsAppConversation.update({
          where: { phoneNumber },
          data: { step: 'AWAITING_EMAIL' },
        })
        return { immediate: ASK_EMAIL }
      }
      // Create the in-progress Episode now so all subsequent updates write to
      // the same row. The user will see it in their /episodes list on the web.
      const episode = await prisma.episode.create({
        data: {
          guestName: text,
          createdByEmail: convo.userEmail,
          status: 'draft',
          currentStep: 1,
        },
      })
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: {
          step: 'AWAITING_ANGLE',
          guestName: text,
          episodeId: episode.id,
        },
      })
      return { immediate: askAngle(text) }
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
        immediate: `On it. Drafting 10 questions for ${guestName} (${angle.label} angle). Give me about 20 seconds.`,
        deferredJob: async () => {
          const questions = await generateQuestions(guestName, angle.label)
          // Save the questions onto the Episode row so they show up on the web.
          if (episodeId) {
            await prisma.episode.update({
              where: { id: episodeId },
              data: {
                generatedQuestions: questions.list,
                focusAnswers: { angle: angle.key, source: 'whatsapp' },
                currentStep: 5,
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
      return { immediate: "Still drafting your questions. Sit tight." }
    }
  }
}

async function generateQuestions(
  guestName: string,
  angleLabel: string,
): Promise<{ text: string; list: string[] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: '1. (AI not configured. Contact Ba Studio support.)', list: [] }
  }
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system:
      'You are an expert podcast producer writing interview questions. Style: thoughtful, specific, designed to elicit detailed stories (not yes/no). Never use em dashes; use commas instead.',
    messages: [
      {
        role: 'user',
        content: `Write exactly 10 numbered interview questions (format "1. ...", "2. ...", etc) for a podcast guest named ${guestName}, with a ${angleLabel} angle. Return the numbered list only, with no preamble or closing remarks.`,
      },
    ],
  })
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
  // Pull each numbered line into an array for structured DB storage.
  const list = text
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 10)
  return { text: text || '1. (Could not generate questions. Try again.)', list }
}

// WhatsApp episode-prep conversation. Three steps, in order:
//   1. Ask for the guest's name
//   2. Ask for the angle (1/2/3)
//   3. Generate 10 interview questions and send them
//
// State is per phone number, persisted in MarketingEmailCampaign... err,
// WhatsAppConversation. Each inbound message advances exactly one step, and
// the state machine is idempotent: if the user sends a stray message during
// the generation step we just say "still drafting" instead of restarting.
//
// Restart command: typing "restart" / "reset" / "start over" / "cancel" at
// any point clears the state and starts again from step 1.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

type AngleKey = 'business' | 'personal' | 'craft'
const ANGLES: Record<'1' | '2' | '3', { key: AngleKey; label: string }> = {
  '1': { key: 'business', label: 'Business' },
  '2': { key: 'personal', label: 'Personal story' },
  '3': { key: 'craft', label: 'Craft / expertise' },
}

const WELCOME =
  "Hi! I'll help you prep a podcast episode in three quick steps.\n\nWhat's your guest's name?"

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

// First reply we send IMMEDIATELY back through the Twilio webhook response.
// Returned alongside `deferredJob`, which the webhook should run AFTER closing
// the response (via Next's `after()` helper) so Twilio doesn't time out on long
// AI calls.
export interface ConversationStepResult {
  immediate: string
  // Optional async job: produces a follow-up message we send via Twilio REST API
  // after the webhook has already replied 200 OK.
  deferredJob?: () => Promise<string>
}

export async function handleInboundMessage(
  phoneNumber: string,
  body: string,
): Promise<ConversationStepResult> {
  const text = body.trim()

  // Universal escape hatch.
  if (isRestart(text)) {
    await prisma.whatsAppConversation.upsert({
      where: { phoneNumber },
      create: { phoneNumber, step: 'AWAITING_GUEST_NAME' },
      update: { step: 'AWAITING_GUEST_NAME', guestName: null, angle: null },
    })
    return { immediate: WELCOME }
  }

  // Find-or-create the conversation row.
  const convo = await prisma.whatsAppConversation.upsert({
    where: { phoneNumber },
    create: { phoneNumber, step: 'IDLE' },
    update: {},
  })

  switch (convo.step) {
    case 'IDLE': {
      // Any inbound from idle restarts the flow.
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'AWAITING_GUEST_NAME', guestName: null, angle: null },
      })
      return { immediate: WELCOME }
    }

    case 'AWAITING_GUEST_NAME': {
      if (text.length < 2 || text.length > 100) {
        return { immediate: "Please send the guest's name (just their name)." }
      }
      const name = text
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'AWAITING_ANGLE', guestName: name },
      })
      return { immediate: askAngle(name) }
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
      await prisma.whatsAppConversation.update({
        where: { phoneNumber },
        data: { step: 'GENERATING', angle: angle.key },
      })
      return {
        immediate: `On it. Drafting 10 questions for ${guestName} (${angle.label} angle). Give me about 20 seconds.`,
        deferredJob: async () => {
          const questions = await generateQuestions(guestName, angle.label)
          // Hand the user back to idle so the next message starts fresh.
          await prisma.whatsAppConversation.update({
            where: { phoneNumber },
            data: { step: 'IDLE' },
          })
          return `Here are 10 questions for ${guestName} (${angle.label} angle):\n\n${questions}\n\nReply "restart" to prep another episode.`
        },
      }
    }

    case 'GENERATING': {
      // Stray message while we're still generating. Don't double-start.
      return { immediate: "Still drafting your questions. Sit tight." }
    }
  }
}

async function generateQuestions(guestName: string, angleLabel: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return '1. (AI not configured. Please contact Ba Studio support.)'
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
  return text || '1. (Could not generate questions. Try again.)'
}

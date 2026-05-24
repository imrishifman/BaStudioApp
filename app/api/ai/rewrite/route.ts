import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

// Inline "Writing Tools": rewrite a selected snippet. Lightweight + fast (Haiku).
const INSTRUCTIONS: Record<string, string> = {
  rephrase: 'Rephrase the following text. Keep its meaning and roughly the same length.',
  shorten: 'Make the following text more concise without losing the key meaning.',
  punchier: 'Rewrite the following text to be punchier and more engaging. Keep the meaning.',
  formal: 'Rewrite the following text in a more formal, professional tone.',
}

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, action } = await req.json()
  if (!text?.trim() || !INSTRUCTIONS[action]) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: 'Selection is too long' }, { status: 413 })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system:
        'You are an expert editor. Return ONLY the rewritten text — no preamble, quotation marks, or explanation.',
      messages: [{ role: 'user', content: `${INSTRUCTIONS[action]}\n\nText:\n${text}` }],
    })
    const out = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!out) return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 })
    return NextResponse.json({ text: out })
  } catch (err) {
    console.error('Rewrite AI error:', err)
    return NextResponse.json({ error: 'Rewrite failed' }, { status: 500 })
  }
}

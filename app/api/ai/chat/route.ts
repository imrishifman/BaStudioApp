import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildChatPrompt } from '@/lib/ai/prompts'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, episodeContext, page } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const prompt = buildChatPrompt(message, episodeContext ?? null, page ?? null)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
  }
}

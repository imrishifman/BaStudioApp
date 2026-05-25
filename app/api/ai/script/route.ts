import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { buildScriptPrompt } from '@/lib/ai/prompts'
import { extractJson, aiErrorMessage } from '@/lib/ai/json'

export const maxDuration = 60

export async function POST(req: Request) {
  const anthropic = new Anthropic()
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, showId, kind = 'full', setStatus = true, instruction, currentScript } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({ where: { id: episodeId, createdByEmail: session.user.email } })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Revision path: apply a one-off change request to the whole script.
    if (instruction) {
      const base = currentScript ?? episode.fullScript ?? ''
      const revisePrompt = `Here is a podcast interview script in markdown:\n"""\n${base}\n"""\n\nApply this change request, keeping everything else intact: ${instruction}\n\nReturn the FULL updated script. Return JSON: { "script": "..." }`
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        messages: [{ role: 'user', content: revisePrompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const { script } = extractJson<{ script: string }>(text)
      await prisma.episode.update({ where: { id: episodeId }, data: { fullScript: script } })
      return NextResponse.json({ script })
    }

    const show = showId ? await prisma.show.findUnique({ where: { id: showId } }) : null
    const prompt = buildScriptPrompt(episode, show, kind)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: kind === 'full' ? 4500 : 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const { script } = extractJson<{ script: string }>(text)

    // Early auto-drafts (setStatus=false) save the text without advancing the
    // pipeline status — the user is still earlier in the wizard.
    const updateData =
      kind === 'intro'
        ? { introductionScript: script, ...(setStatus ? { status: 'script' as const } : {}) }
        : { fullScript: script, ...(setStatus ? { status: 'review' as const } : {}) }

    await prisma.episode.update({ where: { id: episodeId }, data: updateData })

    return NextResponse.json({ script })
  } catch (err) {
    console.error('Script AI error:', err)
    const { message, status } = aiErrorMessage(err)
    return NextResponse.json({ error: message }, { status })
  }
}

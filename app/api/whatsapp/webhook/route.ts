// Inbound WhatsApp webhook. Twilio POSTs every message a user sends to the
// sandbox (or eventually our real number) here.
//
// We delegate the actual conversation logic to lib/whatsapp/conversation.ts.
// The webhook is responsible for:
//   - validating Twilio's signature (security)
//   - sending the immediate reply
//   - kicking off any long-running follow-up (AI generation) AFTER the 200 OK,
//     using next/server's `after()` so Twilio doesn't time out at 15s.

import { NextResponse, after } from 'next/server'
import twilio from 'twilio'
import { sendWhatsApp } from '@/lib/whatsapp/client'
import { handleInboundMessage } from '@/lib/whatsapp/conversation'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function publicUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const path = new URL(req.url).pathname
  return `${proto}://${host}${path}`
}

export async function POST(req: Request) {
  // Parse Twilio's x-www-form-urlencoded payload.
  const rawForm = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of rawForm.entries()) params[k] = String(v)

  // Signature check. Validate when an auth token is configured.
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (authToken) {
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const url = publicUrl(req)
    const ok = twilio.validateRequest(authToken, signature, url, params)
    if (!ok) {
      console.warn('Twilio signature check failed for', url)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  }

  const from = params.From
  const body = (params.Body ?? '').trim()
  console.log('Inbound WhatsApp:', { from, body })

  if (!from) {
    return NextResponse.json({ ok: true, ignored: 'no_from' })
  }

  // Drive the state machine.
  let result: Awaited<ReturnType<typeof handleInboundMessage>>
  try {
    result = await handleInboundMessage(from, body)
  } catch (err) {
    console.error('Conversation handler error:', err)
    try {
      await sendWhatsApp(from, 'Something went wrong on our side. Reply "restart" to try again.')
    } catch (sendErr) {
      console.error('Could not send error notice:', sendErr)
    }
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Send the immediate reply.
  try {
    await sendWhatsApp(from, result.immediate)
  } catch (err) {
    console.error('Could not send WhatsApp reply:', err)
  }

  // If the step kicked off a longer AI job, run it AFTER the response is sent.
  // `after()` keeps the lambda warm without holding the response open.
  if (result.deferredJob) {
    const job = result.deferredJob
    after(async () => {
      try {
        const followUp = await job()
        await sendWhatsApp(from, followUp)
      } catch (err) {
        console.error('Deferred WhatsApp job failed:', err)
        try {
          await sendWhatsApp(
            from,
            'I hit a snag drafting your questions. Reply "restart" to try again.',
          )
        } catch (sendErr) {
          console.error('Could not send failure notice:', sendErr)
        }
      }
    })
  }

  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Inbound WhatsApp webhook. Twilio POSTs every message a user sends to the
// sandbox (or eventually our real number) here.
//
// For the MVP this just echoes the incoming text so we can prove the round
// trip works end to end. The 3-step episode-prep conversation will layer on
// top of this in the next change.
//
// Security: when TWILIO_AUTH_TOKEN is present we validate the X-Twilio-Signature
// header so random posters can't spoof inbound messages.

import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { sendWhatsApp } from '@/lib/whatsapp/client'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

function publicUrl(req: Request): string {
  // Twilio signs the EXACT URL we configured in its dashboard. Vercel rewrites
  // host headers, so we have to reconstruct the canonical https URL the user
  // hits (e.g. https://bastudiopodcast.com/api/whatsapp/webhook).
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const path = new URL(req.url).pathname
  return `${proto}://${host}${path}`
}

export async function POST(req: Request) {
  // Twilio posts as application/x-www-form-urlencoded.
  const rawForm = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of rawForm.entries()) params[k] = String(v)

  // Optional signature check. In dev (no auth token) we skip it; in prod we
  // require a valid signature.
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

  const from = params.From       // e.g. "whatsapp:+972501234567"
  const body = (params.Body ?? '').trim()
  console.log('Inbound WhatsApp:', { from, body })

  if (!from) {
    return NextResponse.json({ ok: true, ignored: 'no_from' })
  }

  // MVP echo. Sent via REST API (not TwiML response) so future steps can
  // do async work (Claude calls, DB writes) without holding the webhook open.
  try {
    await sendWhatsApp(from, `Hello from Ba Studio. You said: ${body || '(nothing)'}`)
  } catch (err) {
    console.error('Could not send WhatsApp reply:', err)
  }

  // Twilio expects 200 OK quickly. An empty TwiML body is the documented way
  // to say "no inline reply" while we send the real reply via the REST API.
  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

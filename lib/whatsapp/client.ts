// Twilio WhatsApp wrapper. Centralises the SDK init + the canonical sender
// number so route code stays clean.

import twilio from 'twilio'

export const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886' // sandbox default

export function getTwilio(): ReturnType<typeof twilio> | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

// Send a WhatsApp message. Throws on the SDK side if Twilio rejects (invalid
// number, sandbox not joined, etc.) so callers can decide whether to retry.
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const client = getTwilio()
  if (!client) {
    console.warn('Twilio credentials missing - cannot send WhatsApp')
    return
  }
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: formattedTo,
    body,
  })
}

import { Resend } from 'resend'

// Single Resend client + canonical FROM. Keeping both here means every email
// path uses the same configuration and we don't recreate the SDK per request.
// RESEND_API_KEY is already provisioned alongside the existing booking and
// influencer-invite flows.

export const RESEND_FROM =
  process.env.RESEND_FROM ?? 'Ba Studio <noreply@bastudiopodcast.com>'

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

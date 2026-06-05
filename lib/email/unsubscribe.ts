// Unsubscribe token helpers.
//
// We never put the user id or email in the unsubscribe URL. Each user gets a
// random opaque token, generated the first time a marketing email is sent to
// them and stored on the User row. The /unsubscribe page validates the token
// and flips marketingEmailOptIn off.

import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'

// Returns the user's existing unsubscribe token, or generates and stores one.
export async function ensureUnsubscribeToken(userId: string, existing: string | null): Promise<string> {
  if (existing) return existing
  // 32 random bytes -> 43-char URL-safe base64. Plenty of entropy.
  const token = crypto.randomBytes(32).toString('base64url')
  await prisma.user.update({ where: { id: userId }, data: { unsubscribeToken: token } })
  return token
}

export function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`
}

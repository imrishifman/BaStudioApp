// Signed approve/reject tokens for one-click email links (no login needed).
// HMAC over "postId.action" with a server secret. The link only lets the holder
// flip that one post to approved/rejected, nothing else.
import { createHmac } from 'crypto'

function secret(): string {
  return (
    process.env.SOCIAL_APPROVAL_SECRET ??
    process.env.CRON_SECRET ??
    process.env.AUTH_SECRET ??
    'insecure-dev-secret'
  )
}

type Action = 'approve' | 'reject'

export function signApproval(postId: string, action: Action): string {
  const payload = `${postId}.${action}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 32)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

// Approve/reject a whole batch (a week) with one link. cuid ids contain no
// dots or commas, so we join with "," and reuse the single-token format.
export function signApprovalBatch(postIds: string[], action: Action): string {
  return signApproval(postIds.join(','), action)
}

// A stable, long-lived capability token for a named trigger (e.g. an external
// scheduler that pokes /api/social/publish). It carries no secret and only lets
// the holder run that one named action, never approve or post arbitrary content.
export function signTrigger(name: string): string {
  const payload = `trigger:${name}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 32)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyTrigger(token: string, name: string): boolean {
  try {
    const expected = signTrigger(name)
    return token === expected
  } catch {
    return false
  }
}

export function verifyApproval(token: string): { postId: string; action: Action } | null {
  try {
    const [postId, action, sig] = Buffer.from(token, 'base64url').toString().split('.')
    if (action !== 'approve' && action !== 'reject') return null
    const expected = createHmac('sha256', secret())
      .update(`${postId}.${action}`)
      .digest('hex')
      .slice(0, 32)
    if (!postId || sig !== expected) return null
    return { postId, action }
  } catch {
    return null
  }
}

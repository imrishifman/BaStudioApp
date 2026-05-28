import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

// Salt for IP hashing. Used only for fraud detection (we never store raw IPs
// long-term). Set via env in prod; falls back to a constant for local dev so
// hashes are stable across restarts.
const IP_SALT = process.env.REFERRAL_IP_SALT ?? 'bastudio-dev-salt-not-secret'

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(IP_SALT + ip).digest('hex').slice(0, 32)
}

// Resolve a raw ref code (e.g. "ALEX20" or "alex20") to an Influencer.
// We match on couponCode (uppercased) - this is the same code an influencer
// gives their audience to use at checkout, so URL ref param and coupon code
// stay unified.
export async function findInfluencerByRefCode(code: string | undefined | null) {
  if (!code) return null
  const clean = code.trim().toUpperCase()
  if (!clean) return null
  return prisma.influencer.findFirst({
    where: { couponCode: clean, status: 'active' },
  })
}

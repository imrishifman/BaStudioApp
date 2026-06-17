// Lightweight in-memory per-key rate limiter for public, unauthenticated
// endpoints (e.g. the free AI tools used for organic acquisition).
//
// NOTE: state lives in the warm serverless instance only, so this is a SOFT
// guard against a single client hammering one instance, not a hard global cap.
// Combined with tight per-request token limits it keeps cost bounded for a v1
// launch. Before promoting a tool heavily, upgrade to a shared store
// (Upstash/Redis or a Postgres counter) for a true global limit.

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export interface RateLimitResult { ok: boolean; remaining: number; retryAfterSec: number }

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 }
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count += 1
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 }
}

// Best-effort client IP from the standard proxy header (Vercel sets it).
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim()
}

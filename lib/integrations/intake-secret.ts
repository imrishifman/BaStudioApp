import { timingSafeEqual } from 'crypto'

// Shared secret check for the server-to-server intake endpoints called by the
// Cold Call Manager (influencer-intake, caller-intake). One implementation so
// the timing-safe comparison never drifts between endpoints.

// Trim both sides: pasting into the Vercel env UI (or a curl header) easily
// picks up a trailing newline/space, which must not break a byte comparison.
export function intakeSecretMatches(provided: string | null): boolean {
  const expected = process.env.INTAKE_SHARED_SECRET?.trim()
  const given = provided?.trim()
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// 401 diagnostic that never leaks the secret: distinguishes "the server has no
// secret configured" from "the provided secret does not match", so env-var
// setup problems are debuggable from the response alone.
export function intakeUnauthorizedReason(): string {
  return process.env.INTAKE_SHARED_SECRET?.trim() ? 'secret-mismatch' : 'server-secret-not-configured'
}

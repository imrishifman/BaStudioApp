// Comp (complimentary) plan grants by email.
//
// Any email listed here is automatically upgraded to its plan the first time the
// account signs in (see the signIn callback in lib/auth.ts), and shown a one-off
// welcome message on first load. Add an entry to comp a notable user (e.g. an
// influencer) without them ever touching billing.
//
// Pure module: NO Prisma or other Node-only imports, so it is safe to use from
// edge-safe files too. Keys are lowercased emails.

export type CompPlan = 'master' | 'solo'

export interface CompGrant {
  plan: CompPlan
  from: string // who the gift is from, shown in the welcome message
}

const GRANTS: Record<string, CompGrant> = {
  'shep@hyken.com': { plan: 'master', from: 'Imri' },
}

export function compGrantFor(email?: string | null): CompGrant | null {
  if (!email) return null
  return GRANTS[email.trim().toLowerCase()] ?? null
}

const PLAN_LABEL: Record<CompPlan, string> = { master: 'Master', solo: 'Solo' }

// The one-time welcome message. firstName may be null (we fall back to "there").
export function compWelcomeMessage(firstName: string | null | undefined, grant: CompGrant): string {
  const name = firstName?.trim() || 'there'
  return `Hey ${name}, we are happy to see you here. You got an unlimited ${PLAN_LABEL[grant.plan]} plan from ${grant.from}.`
}

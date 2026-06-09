// Pure, client-safe plan helpers. No server imports here so this can be pulled
// into client components (wizard steps) without dragging Prisma into the
// browser bundle. Server-only guards live in plan-access.server.ts.

export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'solo' || plan === 'master'
}

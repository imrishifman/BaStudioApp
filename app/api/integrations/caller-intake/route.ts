import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { intakeSecretMatches, intakeUnauthorizedReason } from '@/lib/integrations/intake-secret'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

// Server-to-server caller registration for the Cold Call Manager
// (calls.bastudiopodcast.com). When an admin creates (or updates) a caller in
// the calling portal, that server calls this so the SAME person is registered
// as a Caller in BA Studio immediately - they appear in Admin -> Commissions and
// can open their /caller dashboard before they enroll their first studio.
//
// Auth: x-intake-secret header must equal INTAKE_SHARED_SECRET (timing-safe),
// the same trusted server that holds the influencer-intake secret.
// Idempotent by email: an existing caller is updated in place, never duplicated.
// The calling portal is the system of record for caller identity, so name /
// contact / status are refreshed from it when provided.

function shape(c: { id: string; name: string; email: string; status: string }) {
  return { id: c.id, name: c.name, email: c.email, status: c.status }
}

export async function POST(req: Request) {
  if (!intakeSecretMatches(req.headers.get('x-intake-secret'))) {
    return NextResponse.json({ error: 'Unauthorized', reason: intakeUnauthorizedReason() }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : ''
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    return NextResponse.json({ error: 'A valid name and email are required' }, { status: 400 })
  }
  const contact = typeof body?.contact === 'string' && body.contact.trim() ? body.contact.trim() : null
  // Status is only applied when the caller explicitly sends it, so a plain
  // "create/update" call never silently reactivates a caller an admin paused.
  const status = body?.status === 'inactive' ? 'inactive' : body?.status === 'active' ? 'active' : undefined

  try {
    const caller = await prisma.caller.upsert({
      where: { email },
      create: { email, name, contact, status: status ?? 'active' },
      update: {
        name,
        ...(contact ? { contact } : {}),
        ...(status ? { status } : {}),
      },
      select: { id: true, name: true, email: true, status: true },
    })
    return NextResponse.json(shape(caller))
  } catch (err) {
    console.error('[caller-intake] error:', err)
    return NextResponse.json({ error: 'Caller registration failed' }, { status: 500 })
  }
}

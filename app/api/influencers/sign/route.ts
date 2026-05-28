import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Public endpoint - the signature token itself is the authentication.
// Marks an influencer's agreement as signed, captures the IP, and is
// idempotent: re-signing the same token returns ok without changing data.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = String(body?.token ?? '')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const influencer = await prisma.influencer.findFirst({
    where: { agreementSignatureToken: token },
    select: { id: true, agreementSigned: true, status: true },
  })
  if (!influencer) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  // Idempotent: already signed -> just return ok.
  if (influencer.agreementSigned) {
    return NextResponse.json({ ok: true, alreadySigned: true })
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  await prisma.influencer.update({
    where: { id: influencer.id },
    data: {
      agreementSigned: true,
      agreementSignedDate: new Date(),
      agreementIpAddress: ip,
      // Move from "invited" to "active" once they've signed. Admin can still
      // pause/disable explicitly via status edits.
      status: influencer.status === 'pending' ? 'active' : influencer.status,
      couponActive: true,
    },
  })

  return NextResponse.json({ ok: true })
}

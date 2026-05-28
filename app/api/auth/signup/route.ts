import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { findInfluencerByRefCode } from '@/lib/referrals'

const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().trim().min(1).max(120).optional(),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase().trim()
  const { password, fullName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered - try signing in instead.' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: fullName ?? null,
    },
  })

  // Attribute the new user to an influencer if a referral cookie is present
  // and active. Anti-self-referral: block when the new user's email matches
  // the influencer's own email. Best-effort - signup must succeed even if
  // attribution fails.
  try {
    const ck = await cookies()
    const refCode = ck.get('bas_ref')?.value
    const visitorId = ck.get('bas_vid')?.value
    if (refCode && visitorId) {
      const influencer = await findInfluencerByRefCode(refCode)
      if (influencer && influencer.email?.toLowerCase() !== email) {
        await prisma.referralAttribution.upsert({
          where: { userEmail: email },
          create: {
            userEmail: email,
            influencerId: influencer.id,
            visitorId,
            source: 'ref_link',
            rawCode: refCode,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          // First-touch wins - never overwrite an existing attribution.
          update: {},
        })
      }
    }
  } catch (err) {
    console.error('Referral attribution at signup failed:', err)
  }

  return NextResponse.json({ ok: true })
}

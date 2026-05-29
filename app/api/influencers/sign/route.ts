import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 20

// Public endpoint - the signature token itself is the authentication.
// Marks an influencer's agreement as signed, captures the IP, activates the
// coupon, and sends a confirmation email with their code + referral link.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = String(body?.token ?? '')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const influencer = await prisma.influencer.findFirst({
    where: { agreementSignatureToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      couponCode: true,
      commissionType: true,
      commissionValue: true,
      agreementSigned: true,
      status: true,
    },
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
      status: influencer.status === 'pending' ? 'active' : influencer.status,
      couponActive: true,
      onboardingStep: 'agreement_signed',
    },
  })

  // Send confirmation email (best-effort - signature still succeeds if email fails).
  void sendSignedConfirmation(influencer, req).catch((err) => {
    console.error('[agreement-confirmation-email] failed:', err)
  })

  return NextResponse.json({ ok: true })
}

async function sendSignedConfirmation(
  inf: {
    name: string
    email: string | null
    couponCode: string | null
    commissionType: string | null
    commissionValue: number | null
  },
  req: Request,
) {
  if (!process.env.RESEND_API_KEY || !inf.email) return
  const from = process.env.RESEND_FROM ?? 'Ba Studio <hello@bastudiopodcast.com>'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const referralUrl = inf.couponCode ? `${baseUrl}/?ref=${inf.couponCode}` : null
  const commissionLabel = inf.commissionType === 'fixed'
    ? `$${inf.commissionValue ?? 0} per signup`
    : `${inf.commissionValue ?? 0}%`

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f7; padding:32px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="font-size:48px; text-align:center; margin-bottom:16px;">🎉</div>
    <h1 style="font-size:24px; font-weight:700; color:#0a0a0a; margin:0 0 12px; text-align:center;">You're live, ${inf.name.split(' ')[0]}!</h1>
    <p style="font-size:16px; line-height:1.55; color:#3a3a3a; margin:0 0 24px; text-align:center;">
      Your partnership agreement is signed and your coupon code is active.
    </p>

    ${inf.couponCode ? `
    <div style="background:#f5f5f7; border-radius:10px; padding:18px; margin:0 0 16px;">
      <p style="font-size:12px; color:#666; margin:0 0 6px;">Your coupon code</p>
      <p style="font-size:24px; font-weight:700; letter-spacing:2px; font-family:SF Mono, monospace; color:#0a0a0a; margin:0;">${inf.couponCode}</p>
    </div>` : ''}

    ${referralUrl ? `
    <div style="background:#f5f5f7; border-radius:10px; padding:18px; margin:0 0 24px;">
      <p style="font-size:12px; color:#666; margin:0 0 6px;">Your referral link</p>
      <p style="font-size:13px; font-family:SF Mono, monospace; color:#0a0a0a; margin:0; word-break:break-all;">${referralUrl}</p>
    </div>` : ''}

    <div style="background:#f5f5f7; border-radius:10px; padding:18px; margin:0 0 28px;">
      <p style="font-size:13px; font-weight:600; color:#0a0a0a; margin:0 0 8px;">Commission</p>
      <p style="font-size:14px; color:#3a3a3a; margin:0;">${commissionLabel} on every paid conversion · Payouts every Monday via Stripe</p>
    </div>

    <div style="text-align:center; margin:0 0 28px;">
      <a href="${baseUrl}/partner" style="display:inline-block; background:#0a0a0a; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:999px; font-weight:600; font-size:15px;">Open my partner dashboard</a>
    </div>

    <p style="font-size:13px; line-height:1.55; color:#666; margin:0;">
      <strong>Don't forget:</strong> disclose the partnership in your content
      (#ad or #sponsored) to comply with FTC rules.
    </p>
    <hr style="border:none; border-top:1px solid #eee; margin:32px 0 20px;">
    <p style="font-size:12px; color:#aaa; margin:0;">
      Ba Studio · AI Podcast Production<br>
      You're receiving this because you just signed our partner agreement.
    </p>
  </div>
</body></html>`

  await resend.emails.send({
    from,
    to: inf.email,
    subject: '🎉 You\'re live as a Ba Studio partner',
    html,
  })
}

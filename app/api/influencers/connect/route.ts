import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

// GET ?token=xxx       — public: fetch the influencer matching a signature token.
// GET (no token)       — admin: list all influencers.
// POST                 — admin: create an influencer AND email them the invite.
// POST { resend: true } — admin: re-send the invite email for an existing influencer.
export async function GET(req: Request) {
  const session = await auth()
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // Public token lookup - no auth required (the token itself is the auth).
  if (token) {
    const influencer = await prisma.influencer.findFirst({
      where: { agreementSignatureToken: token },
      select: { id: true, name: true, commissionValue: true, commissionType: true, agreementSigned: true },
    })
    if (!influencer) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    return NextResponse.json(influencer)
  }

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const influencers = await prisma.influencer.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(influencers)
}

// Builds the invite URL the influencer clicks to sign. NEXT_PUBLIC_APP_URL is
// the production origin; falls back to the request origin so previews/local dev
// also work without configuration.
function buildInviteUrl(token: string, origin: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? origin
  return `${base}/influencer-agreement?token=${token}`
}

async function sendInviteEmail(opts: {
  name: string
  email: string
  inviteUrl: string
  commissionValue: number | null
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - skipping invite email')
    return { sent: false, reason: 'no-resend-key' as const }
  }
  const from = process.env.RESEND_FROM ?? 'Ba Studio <noreply@bastudiopodcast.com>'
  const resend = new Resend(process.env.RESEND_API_KEY)
  const commissionLine = opts.commissionValue
    ? `You'll earn ${opts.commissionValue}% commission on every paid subscription you refer.`
    : `Commission terms are detailed in the agreement.`
  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f7; padding:32px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; padding:40px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="font-size:26px; font-weight:700; color:#0a0a0a; margin:0 0 12px;">You're invited to Ba Studio's partner program</h1>
    <p style="font-size:16px; line-height:1.55; color:#3a3a3a; margin:0 0 20px;">Hi ${opts.name},</p>
    <p style="font-size:16px; line-height:1.55; color:#3a3a3a; margin:0 0 20px;">
      We'd love to have you on board as a Ba Studio partner. ${commissionLine}
    </p>
    <p style="font-size:16px; line-height:1.55; color:#3a3a3a; margin:0 0 28px;">
      Click below to review the terms and sign your partnership agreement:
    </p>
    <div style="text-align:center; margin:0 0 28px;">
      <a href="${opts.inviteUrl}" style="display:inline-block; background:#0a0a0a; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:999px; font-weight:600; font-size:15px;">Review and sign agreement</a>
    </div>
    <p style="font-size:13px; line-height:1.55; color:#888; margin:0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <span style="word-break:break-all;">${opts.inviteUrl}</span>
    </p>
    <hr style="border:none; border-top:1px solid #eee; margin:32px 0 20px;">
    <p style="font-size:13px; color:#aaa; margin:0;">
      Ba Studio · AI Podcast Production<br>
      If you weren't expecting this, just ignore the email.
    </p>
  </div>
</body></html>`

  // Log the from/to so we can see in Vercel logs exactly what Resend was asked
  // to send (helps diagnose silent drops due to unverified senders).
  console.log(`[invite-email] from=${from} to=${opts.email} subject=invite`)
  try {
    const result = await resend.emails.send({
      from,
      to: opts.email,
      subject: 'You\'re invited to Ba Studio\'s partner program',
      html,
    })
    // CRITICAL: Resend's SDK does NOT throw when the API returns an error in
    // the response body (e.g. unverified domain, invalid recipient). It
    // returns { data: null, error: {...} }. Always inspect the error field.
    if (result.error || !result.data?.id) {
      console.error('[invite-email] Resend returned error:', JSON.stringify(result.error))
      return {
        sent: false,
        reason: 'send-failed' as const,
        error: result.error?.message ?? 'No id returned',
      }
    }
    console.log(`[invite-email] sent successfully id=${result.data.id}`)
    return { sent: true, id: result.data.id }
  } catch (err) {
    console.error('[invite-email] Resend threw:', err)
    return { sent: false, reason: 'send-failed' as const, error: (err as Error).message }
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !isAdmin(session.user.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const origin = new URL(req.url).origin

  // Resend invite for an existing influencer by id.
  if (body?.resend && body?.influencerId) {
    const inf = await prisma.influencer.findUnique({ where: { id: body.influencerId } })
    if (!inf || !inf.email || !inf.agreementSignatureToken) {
      return NextResponse.json({ error: 'Influencer not found or missing token/email' }, { status: 404 })
    }
    const inviteUrl = buildInviteUrl(inf.agreementSignatureToken, origin)
    const emailResult = await sendInviteEmail({
      name: inf.name,
      email: inf.email,
      inviteUrl,
      commissionValue: inf.commissionValue,
    })
    await prisma.influencer.update({
      where: { id: inf.id },
      data: { agreementSentDate: new Date() },
    })
    return NextResponse.json({ ok: true, inviteUrl, email: emailResult })
  }

  // Create new influencer + send invite email.
  const { name, email, handle, commissionValue, couponCode } = body as {
    name?: string; email?: string; handle?: string; commissionValue?: number; couponCode?: string
  }
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })

  // Generate the signature token via Node's crypto.randomUUID (available in
  // the Node.js runtime - matches the previous behaviour).
  const token = crypto.randomUUID()

  const influencer = await prisma.influencer.create({
    data: {
      name,
      email,
      handle: handle ?? null,
      couponCode: couponCode?.toUpperCase() ?? null,
      commissionType: 'percentage',
      commissionValue: commissionValue ?? 20,
      agreementSignatureToken: token,
      agreementSentDate: new Date(),
    },
  })

  const inviteUrl = buildInviteUrl(token, origin)
  const emailResult = await sendInviteEmail({
    name: influencer.name,
    email: influencer.email!,
    inviteUrl,
    commissionValue: influencer.commissionValue,
  })

  return NextResponse.json({ ...influencer, inviteUrl, email: emailResult })
}

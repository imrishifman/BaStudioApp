import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'noreply@bastudio.app'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { episodeId, guestEmail } = await req.json()
  if (!episodeId) return NextResponse.json({ error: 'episodeId required' }, { status: 400 })
  if (!guestEmail) return NextResponse.json({ error: 'guestEmail required' }, { status: 400 })

  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, createdByEmail: session.user.email },
    include: { show: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const toEmail: string = guestEmail

  const briefUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudio.app'}/brief/${episode.id}`

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Your guest brief for "${episode.show?.name ?? 'the show'}"`,
    html: `
      <p>Hi ${episode.guestName},</p>
      <p>You're confirmed as a guest on <strong>${episode.show?.name ?? 'the show'}</strong>. Here's your guest brief with everything you need to know:</p>
      <p><a href="${briefUrl}" style="background:#000;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;display:inline-block;">View your brief</a></p>
      <p>See you soon!</p>
    `,
  })

  return NextResponse.json({ ok: true })
}

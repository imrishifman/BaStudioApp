// Weekly social recap email to Imri. Cron only (Bearer CRON_SECRET).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getResend, RESEND_FROM } from '@/lib/email/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const since = new Date(Date.now() - 7 * 86_400_000)
  const [published, pending, failed] = await Promise.all([
    prisma.socialPost.findMany({
      where: { status: 'published', publishedAt: { gte: since } },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.socialPost.count({ where: { status: 'pending_approval' } }),
    prisma.socialPost.findMany({ where: { status: 'failed', createdAt: { gte: since } } }),
  ])

  const resend = getResend()
  if (!resend) return NextResponse.json({ skipped: 'no resend' })
  const to = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? 'imri@babalata.com')
    .split(',')[0]
    .trim()

  const rows =
    published
      .map(
        (p) =>
          `<li><a href="${p.permalink ?? '#'}" style="color:#FF5C3C">${p.permalink ?? p.igMediaId ?? p.id}</a></li>`,
      )
      .join('') || '<li>none</li>'
  const failedRows = failed.map((p) => `<li>${p.id}: ${p.error ?? 'unknown'}</li>`).join('')
  const html = `<div style="font-family:Inter,Arial;color:#0E1117"><h2>Ba Studio social, weekly recap</h2><p><b>${published.length}</b> published this week:</p><ul>${rows}</ul><p>Pending your approval: <b>${pending}</b></p>${failed.length ? `<p>Failed: ${failed.length}</p><ul>${failedRows}</ul>` : ''}</div>`

  await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: 'Ba Studio social, weekly recap',
    html,
  })
  return NextResponse.json({ published: published.length, pending, failed: failed.length })
}

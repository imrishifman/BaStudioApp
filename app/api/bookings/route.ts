import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { buildIcs } from '@/lib/ics'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public endpoint: a guest books a recording slot from a shared booking link.
// Emails a calendar invite (.ics) to both the guest and the host so the event
// lands in whichever calendar app they use.
export async function POST(req: Request) {
  const { userId, showId, date, time, guestName, guestEmail } = await req.json()

  if (!userId || !showId || !date || !guestName?.trim() || !EMAIL_RE.test(guestEmail ?? '')) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  const [host, show] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } }),
    prisma.show.findUnique({ where: { id: showId }, select: { name: true, ownerEmail: true } }),
  ])
  if (!host || !show || show.ownerEmail !== host.email) {
    return NextResponse.json({ error: 'Booking link is no longer valid' }, { status: 404 })
  }

  // The chosen day must be a slot the host actually offered.
  const day = new Date(`${date}T00:00:00.000Z`)
  const slot = await prisma.availabilityBlock.findFirst({
    where: { userId, status: 'available', date: day },
  })
  if (!slot) {
    return NextResponse.json({ error: 'That slot is no longer available' }, { status: 409 })
  }

  // Build the event start from the slot's time (default 10:00 UTC if none).
  const [hh, mm] = (time || slot.timeFrom || '10:00').split(':').map((n: string) => parseInt(n, 10))
  const start = new Date(`${date}T00:00:00.000Z`)
  start.setUTCHours(hh || 10, mm || 0, 0, 0)

  const hostName = host.fullName ?? 'your host'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudio.app'
  const ics = buildIcs({
    uid: `booking-${slot.id}-${Date.now()}@bastudio`,
    title: `${show.name} - Recording with ${guestName.trim()}`,
    description: `Podcast recording for "${show.name}" with ${hostName} and ${guestName.trim()}.`,
    start,
    durationMinutes: 60,
    organizer: { name: hostName, email: host.email },
    attendees: [
      { name: guestName.trim(), email: guestEmail },
      { name: hostName, email: host.email },
    ],
    url: appUrl,
    method: 'REQUEST',
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM = process.env.RESEND_FROM ?? 'noreply@bastudio.app'
  const attachments = [
    {
      filename: 'invite.ics',
      content: Buffer.from(ics),
      contentType: 'text/calendar; method=REQUEST; charset=utf-8',
    },
  ]
  const when = start.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
  })

  try {
    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: guestEmail,
        subject: `You're booked: ${show.name}`,
        html: `<p>Hi ${guestName.trim()},</p><p>Your recording slot for <strong>${show.name}</strong> is confirmed for <strong>${when} (UTC)</strong>. The calendar invite is attached - add it to your calendar.</p><p>See you then!</p>`,
        attachments,
      }),
      resend.emails.send({
        from: FROM,
        to: host.email,
        subject: `New booking: ${guestName.trim()} - ${show.name}`,
        html: `<p>${guestName.trim()} (${guestEmail}) booked a recording slot for <strong>${show.name}</strong> on <strong>${when} (UTC)</strong>. The calendar invite is attached.</p>`,
        attachments,
      }),
    ])
  } catch (err) {
    console.error('Booking email error:', err)
    return NextResponse.json({ error: 'Could not send the invite. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

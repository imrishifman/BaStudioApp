// Minimal RFC 5545 iCalendar generator. Produces a single VEVENT that every
// major calendar app (Google, Outlook, Apple) can import or accept as an invite.

interface IcsEvent {
  uid: string
  title: string
  description?: string
  location?: string
  url?: string
  start: Date
  durationMinutes?: number
  organizer?: { name?: string; email: string }
  attendees?: { name?: string; email: string }[]
  /** REQUEST = invitation (attendees get Accept/Decline); PUBLISH = plain add. */
  method?: 'REQUEST' | 'PUBLISH'
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// UTC timestamp in iCalendar form: 20260524T143000Z
function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// Escape per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline).
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function buildIcs(event: IcsEvent): string {
  const method = event.method ?? 'REQUEST'
  const end = new Date(event.start.getTime() + (event.durationMinutes ?? 60) * 60_000)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ba Studio//Calendar//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${esc(event.title)}`,
  ]

  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`)
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`)
  if (event.url) lines.push(`URL:${esc(event.url)}`)
  if (event.organizer) {
    const cn = event.organizer.name ? `;CN=${esc(event.organizer.name)}` : ''
    lines.push(`ORGANIZER${cn}:mailto:${event.organizer.email}`)
  }
  for (const a of event.attendees ?? []) {
    const cn = a.name ? `;CN=${esc(a.name)}` : ''
    lines.push(
      `ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    )
  }

  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR')

  // iCalendar requires CRLF line endings.
  return lines.join('\r\n')
}

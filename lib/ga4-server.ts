import 'server-only'
import crypto from 'node:crypto'

// Server-side GA4 events via the Measurement Protocol. Client events go through
// GTM -> GA4 as usual; this is only for events that happen with no browser in
// the loop (e.g. the daily cron sending the day-5 trial email).
//
// Requires two env vars (set them in Vercel when you want server events in GA4):
//   GA4_MEASUREMENT_ID  e.g. "G-XXXXXXXXXX"   (GA4 Admin > Data Streams)
//   GA4_API_SECRET                            (same screen > Measurement Protocol API secrets)
// When either is missing this is a no-op (logs and returns), so the cron never
// breaks just because GA4 isn't wired yet.

export async function sendServerGa4Event(
  name: string,
  params: Record<string, unknown> = {},
  // A stable per-user id keeps these joined to the right user in GA4. We hash
  // the email so no raw PII leaves our server.
  userKey?: string,
): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID
  const apiSecret = process.env.GA4_API_SECRET
  if (!measurementId || !apiSecret) {
    console.log(`[ga4] skipped ${name} (GA4_MEASUREMENT_ID / GA4_API_SECRET not set)`, params)
    return
  }

  // GA4 requires a client_id. With no browser we derive a stable pseudo-id from
  // the user key (hashed) so repeat events from the same user line up.
  const seed = userKey ?? 'server'
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16)
  const clientId = `${parseInt(hash.slice(0, 8), 16)}.${parseInt(hash.slice(8, 16), 16)}`

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, events: [{ name, params }] }),
      },
    )
  } catch (err) {
    console.error(`[ga4] server event ${name} failed:`, err)
  }
}

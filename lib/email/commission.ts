import 'server-only'
import { getResend, RESEND_FROM } from './client'
import { adminEmails } from '@/lib/admin'
import { pendingPayoutLines, type PayoutLine } from '@/lib/commission/reconcile'

// Admin-facing commission emails: the monthly payout summary (so a payout period
// is never forgotten) and the webhook health alert (so silent tracking failure
// is caught within a day). Best-effort: a mail failure never breaks the cron.

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function payoutTable(lines: PayoutLine[]): string {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 10px;border-top:1px solid #eee">${l.name}</td>
        <td style="padding:6px 10px;border-top:1px solid #eee;color:#666">${l.recipientType}</td>
        <td style="padding:6px 10px;border-top:1px solid #eee;color:#666">${l.email ?? '-'}</td>
        <td style="padding:6px 10px;border-top:1px solid #eee;color:#666">${l.period}</td>
        <td style="padding:6px 10px;border-top:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums">${usd(l.amount)}</td>
      </tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;font-size:14px;width:100%;max-width:640px">
    <thead><tr style="color:#888;text-align:left">
      <th style="padding:6px 10px">Recipient</th><th style="padding:6px 10px">Type</th>
      <th style="padding:6px 10px">Payout email</th><th style="padding:6px 10px">Period</th>
      <th style="padding:6px 10px;text-align:right">Amount</th>
    </tr></thead><tbody>${rows}</tbody></table>`
}

// Sent on the 1st of the month. Lists everything currently owed and unpaid, so
// the admin can run payouts. Returns false (and sends nothing) when nothing is
// due, so an empty month is not noise.
export async function sendMonthlyPayoutSummary(): Promise<boolean> {
  const lines = await pendingPayoutLines()
  if (!lines.length) return false

  const resend = getResend()
  const to = adminEmails()
  if (!resend || !to.length) return false

  const total = lines.reduce((s, l) => s + l.amount, 0)
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#111">
    <h2 style="margin:0 0 4px">Commission payouts due</h2>
    <p style="color:#666;margin:0 0 16px">${lines.length} pending ${lines.length === 1 ? 'payout' : 'payouts'} totalling <b>${usd(total)}</b>. Mark each paid in Admin &rarr; Commissions after sending.</p>
    ${payoutTable(lines)}
    <p style="color:#888;font-size:12px;margin-top:16px">Automated monthly summary from Ba Studio commissions.</p>
  </div>`

  const res = await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: `Commission payouts due - ${usd(total)} across ${lines.length}`,
    html,
  })
  return !res.error
}

// Sent by the daily reconciliation when it had to backfill payments the live
// webhook missed - a signal the Stripe webhook is misconfigured or down. The
// money is already recovered (reconciliation is idempotent + self-healing);
// this just tells the admin to fix the webhook so it doesn't recur.
export async function sendWebhookHealthAlert(recovered: number, scanned: number): Promise<boolean> {
  const resend = getResend()
  const to = adminEmails()
  if (!resend || !to.length) return false

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#111">
    <h2 style="margin:0 0 4px">Commission webhook needs attention</h2>
    <p style="color:#444;margin:0 0 12px">Today's reconciliation backfilled <b>${recovered}</b> commission ${recovered === 1 ? 'event' : 'events'} (from ${scanned} recent paid invoices) that the live Stripe webhook did not record.</p>
    <p style="color:#444;margin:0 0 12px"><b>No money was lost</b> - the reconciliation already recorded them. But the webhook should be sending these in real time.</p>
    <p style="color:#444;margin:0 0 4px">Check in Stripe &rarr; Developers &rarr; Webhooks that the live endpoint <code>/api/stripe/webhook</code> is subscribed to <code>invoice.payment_succeeded</code>, <code>charge.refunded</code>, and <code>charge.dispute.created</code>, and that STRIPE_WEBHOOK_SECRET matches.</p>
    <p style="color:#888;font-size:12px;margin-top:16px">Automated health check from Ba Studio commissions.</p>
  </div>`

  const res = await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: `Commission webhook missed ${recovered} payment${recovered === 1 ? '' : 's'} - action needed`,
    html,
  })
  return !res.error
}

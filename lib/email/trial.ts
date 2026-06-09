// Reverse-trial lifecycle emails. Day 0 fires at signup; day 5 and expiry fire
// from the daily cron. All best-effort (never throw to the caller).

import { SITE_URL } from '@/lib/site'
import { getResend, RESEND_FROM } from './client'
import { emailLayout, emailButton, escapeHtml } from './layout'

function greet(firstName?: string | null): string {
  return firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,'
}

// Day 0: welcome + what Pro unlocks.
export async function sendTrialWelcomeEmail(to: string, firstName?: string | null): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  const body = `
    <h1 style="margin:8px 0 12px 0;color:#eaeaf0;font-size:26px;line-height:32px;font-weight:700;">Your 7 days of Pro start now</h1>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">${greet(firstName)}</p>
    <p style="margin:0 0 12px 0;color:#c7c7cf;font-size:15px;line-height:23px;">Welcome to Ba Studio. For the next 7 days you have full Pro access, no card required. That unlocks:</p>
    <ul style="margin:0 0 8px 18px;padding:0;color:#c7c7cf;font-size:15px;line-height:24px;">
      <li style="margin-bottom:8px;">Unlimited episodes</li>
      <li style="margin-bottom:8px;">Downloadable scripts (.docx)</li>
      <li style="margin-bottom:8px;">Shareable guest briefs (link + email)</li>
      <li style="margin-bottom:8px;">Episode artwork uploads</li>
    </ul>
    ${emailButton(`${SITE_URL}/episodes/new`, 'Create your first episode')}
    <p style="margin:18px 0 0 0;color:#8b8b95;font-size:13px;line-height:20px;">We'll remind you before your trial ends. No surprise charges.</p>
  `
  try {
    await resend.emails.send({ from: RESEND_FROM, to, subject: 'Welcome, your 7 days of Pro start now', html: emailLayout({ preheader: 'Full Pro access for 7 days, no card required.', body }) })
    return true
  } catch (err) { console.error('Trial welcome email failed:', err); return false }
}

// Day 5: 2 days left nudge.
export async function sendTrialReminderEmail(to: string, firstName?: string | null): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  const body = `
    <h1 style="margin:8px 0 12px 0;color:#eaeaf0;font-size:26px;line-height:32px;font-weight:700;">2 days left on your Pro trial</h1>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">${greet(firstName)}</p>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">Your Pro trial ends in 2 days. After that you can still view everything you've made, but downloads and sharing lock. Keep your full toolkit for $19.99/mo.</p>
    ${emailButton(`${SITE_URL}/pricing`, 'Keep Pro')}
  `
  try {
    await resend.emails.send({ from: RESEND_FROM, to, subject: '2 days left on your Pro trial', html: emailLayout({ preheader: 'Downloads and sharing lock when your trial ends.', body }) })
    return true
  } catch (err) { console.error('Trial reminder email failed:', err); return false }
}

// Expiry: what they'll miss + a 20%-off-first-month coupon code.
export async function sendTrialExpiredEmail(to: string, firstName?: string | null, couponCode?: string): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  const couponBlock = couponCode
    ? `<p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">Here's 20% off your first month. Use code <strong style="color:#eaeaf0;">${escapeHtml(couponCode)}</strong> at checkout.</p>`
    : ''
  const body = `
    <h1 style="margin:8px 0 12px 0;color:#eaeaf0;font-size:26px;line-height:32px;font-weight:700;">Your trial ended, here's what you'll miss</h1>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">${greet(firstName)}</p>
    <p style="margin:0 0 16px 0;color:#c7c7cf;font-size:15px;line-height:23px;">Your episodes are safe and still viewable. What's locked now: downloading scripts, sharing guest briefs, episode artwork, and creating new episodes beyond the free limit.</p>
    ${couponBlock}
    ${emailButton(`${SITE_URL}/pricing`, 'Upgrade to Pro, $19.99/mo')}
  `
  try {
    await resend.emails.send({ from: RESEND_FROM, to, subject: 'Your Pro trial ended, here is what you will miss', html: emailLayout({ preheader: 'Your episodes are safe. Downloads and sharing are locked.', body }) })
    return true
  } catch (err) { console.error('Trial expired email failed:', err); return false }
}

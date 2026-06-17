// Sends Imri a one-tap approval email for a queued social post: the rendered
// preview, the caption, and Approve / Reject buttons (signed links, no login).
import { getResend, RESEND_FROM } from './client'
import { signApproval, signApprovalBatch } from '@/lib/social/approval'

interface ApprovalPost {
  id: string
  caption: string
  hashtags?: string | null
  imageUrl?: string | null
  eyebrow?: string
}

function adminEmail(): string {
  return (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? 'imri@babalata.com')
    .split(',')[0]
    .trim()
}

// Label a scheduled date by the day it publishes. scheduledFor is stored at
// 00:00 UTC and posts go out at 17:00 UTC (1 PM NY) on that same calendar day,
// so format in UTC to keep the label and the real publish day in sync.
function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export async function sendApprovalEmail(post: ApprovalPost): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudiopodcast.com'
  const approveUrl = `${base}/api/social/approve?token=${signApproval(post.id, 'approve')}`
  const rejectUrl = `${base}/api/social/approve?token=${signApproval(post.id, 'reject')}`
  const captionHtml = post.caption.replace(/\n/g, '<br>')

  const html = `
  <div style="background:#0E1117;color:#F6F3EE;font-family:Inter,Arial,sans-serif;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
    <div style="font-size:13px;letter-spacing:3px;color:#FF5C3C;font-weight:600;text-transform:uppercase">Approve for @bastudiopodcast</div>
    <h1 style="font-size:22px;margin:10px 0 18px">A new post is ready</h1>
    ${post.imageUrl ? `<img src="${post.imageUrl}" alt="post preview" style="width:100%;border-radius:12px;display:block;margin-bottom:18px"/>` : ''}
    <div style="background:#151A23;border-radius:12px;padding:16px;font-size:14px;line-height:1.5;color:#C9CDD6;white-space:normal">${captionHtml}</div>
    ${post.hashtags ? `<div style="color:#8A93A3;font-size:13px;margin:10px 0 22px">${post.hashtags}</div>` : '<div style="margin-bottom:22px"></div>'}
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${approveUrl}" style="background:#FF5C3C;color:#0E1117;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;display:inline-block">Approve and publish</a></td>
      <td style="padding-left:12px"><a href="${rejectUrl}" style="background:#2A3140;color:#F6F3EE;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:999px;display:inline-block">Reject</a></td>
    </tr></table>
    <p style="color:#6B7280;font-size:12px;margin-top:20px">Approving schedules it to publish to Instagram and the Facebook Page. Nothing posts until you approve.</p>
  </div>`

  const res = await resend.emails.send({
    from: RESEND_FROM,
    to: adminEmail(),
    subject: 'Approve this post for @bastudiopodcast',
    html,
  })
  return !res.error
}

export interface WeeklyApprovalPost {
  id: string
  caption: string
  hashtags?: string | null
  imageUrl?: string | null
  headline?: string
  scheduledFor?: Date | string | null
}

// One digest email for a whole week of posts: an "Approve all" button at the
// top, plus per-post Approve / Reject links. Approve once a week, nothing posts
// until you do, and each approved post goes out on its scheduled day.
export async function sendWeeklyApprovalEmail(posts: WeeklyApprovalPost[]): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  if (posts.length === 0) return false
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bastudiopodcast.com'
  const approveAllUrl = `${base}/api/social/approve?token=${signApprovalBatch(posts.map((p) => p.id), 'approve')}`
  const rejectAllUrl = `${base}/api/social/approve?token=${signApprovalBatch(posts.map((p) => p.id), 'reject')}`

  const cards = posts
    .map((p) => {
      const approveUrl = `${base}/api/social/approve?token=${signApproval(p.id, 'approve')}`
      const rejectUrl = `${base}/api/social/approve?token=${signApproval(p.id, 'reject')}`
      const when = p.scheduledFor ? dayLabel(new Date(p.scheduledFor)) : ''
      const title = (p.headline || p.caption.split('\n')[0] || '').slice(0, 80)
      return `
      <tr><td style="padding:10px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#151A23;border-radius:14px"><tr>
          <td width="120" style="padding:14px 0 14px 14px;vertical-align:top">
            ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" width="106" style="width:106px;border-radius:8px;display:block"/>` : ''}
          </td>
          <td style="padding:14px;vertical-align:top">
            ${when ? `<div style="font-size:12px;letter-spacing:2px;color:#FF5C3C;font-weight:600;text-transform:uppercase">${when} · 1 PM NY</div>` : ''}
            <div style="font-size:15px;color:#F6F3EE;font-weight:600;margin:6px 0 12px;line-height:1.35">${title}</div>
            <a href="${approveUrl}" style="color:#FF5C3C;font-size:13px;font-weight:600;text-decoration:none">Approve</a>
            <span style="color:#2A3140">&nbsp;|&nbsp;</span>
            <a href="${rejectUrl}" style="color:#8A93A3;font-size:13px;text-decoration:none">Reject</a>
          </td>
        </tr></table>
      </td></tr>`
    })
    .join('')

  const html = `
  <div style="background:#0E1117;color:#F6F3EE;font-family:Inter,Arial,sans-serif;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
    <div style="font-size:13px;letter-spacing:3px;color:#FF5C3C;font-weight:600;text-transform:uppercase">Next week on @bastudiopodcast</div>
    <h1 style="font-size:22px;margin:10px 0 6px">${posts.length} posts ready for the week</h1>
    <p style="color:#8A93A3;font-size:14px;line-height:1.5;margin:0 0 20px">Approve the whole week in one tap. Each post publishes on its day at 1 PM New York. Nothing goes out until you approve.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${approveAllUrl}" style="background:#FF5C3C;color:#0E1117;text-decoration:none;font-weight:700;padding:15px 30px;border-radius:999px;display:inline-block;font-size:15px">Approve all ${posts.length} posts</a></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">${cards}</table>
    <p style="margin-top:18px"><a href="${rejectAllUrl}" style="color:#6B7280;font-size:13px;text-decoration:underline">Reject all</a></p>
    <p style="color:#6B7280;font-size:12px;margin-top:14px">You only get this once a week. Approve or skip individual posts above, or approve the whole set with the button.</p>
  </div>`

  const res = await resend.emails.send({
    from: RESEND_FROM,
    to: adminEmail(),
    subject: `Approve next week on @bastudiopodcast (${posts.length} posts)`,
    html,
  })
  return !res.error
}

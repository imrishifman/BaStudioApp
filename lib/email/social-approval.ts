// Sends Imri a one-tap approval email for a queued social post: the rendered
// preview, the caption, and Approve / Reject buttons (signed links, no login).
import { getResend, RESEND_FROM } from './client'
import { signApproval } from '@/lib/social/approval'

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

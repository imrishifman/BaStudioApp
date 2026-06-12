// Shared HTML email shell. Keeps every Ba Studio email visually consistent and
// renders well in Gmail/Outlook/Apple Mail. Inline styles only - external CSS
// is stripped by most clients. Width-capped at 600px which is the standard.

import { SITE_URL } from '@/lib/site'

interface LayoutOptions {
  preheader: string
  body: string
  // Optional footer block (e.g. unsubscribe link) injected below the body.
  footerExtra?: string
  dir?: 'ltr' | 'rtl'
}

export function emailLayout({ preheader, body, footerExtra, dir = 'ltr' }: LayoutOptions): string {
  const align = dir === 'rtl' ? 'right' : 'left'
  return `<!doctype html>
<html lang="${dir === 'rtl' ? 'he' : 'en'}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Ba Studio</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0f;color:#eaeaf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader: visible in inbox previews, hidden in body. -->
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b0b0f;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#16161d;border:1px solid #26262f;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;text-align:${align};">
                <a href="${SITE_URL}" style="text-decoration:none;">
                  <img src="${SITE_URL}/logo-dark.png" alt="ba studio" width="122" height="25" style="display:inline-block;border:0;outline:none;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;text-align:${align};">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid #26262f;color:#8b8b95;font-size:12px;line-height:18px;text-align:${align};">
                ${footerExtra ?? ''}
                <p style="margin:8px 0 0 0;">Ba Studio. AI podcast production.<br/><a href="${SITE_URL}" style="color:#8b8b95;text-decoration:underline;">bastudiopodcast.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// Reusable inline button. text-only fallback for clients that strip styles.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="border-radius:999px;background:#eaeaf0;"><a href="${href}" style="display:inline-block;padding:12px 22px;font-weight:600;font-size:14px;color:#0b0b0f;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a></td></tr></table>`
}

// Conservative HTML escape for user-controlled strings interpolated into emails.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export { escapeHtml }

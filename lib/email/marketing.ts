// Marketing email helper.
//
// Wraps the admin-authored HTML body in the standard branded shell and adds
// the legally-required unsubscribe link in the footer. The body itself is
// inserted as-is (admin authored), which is fine because admin users are
// trusted authors writing for their own audience.

import { emailLayout } from './layout'
import { unsubscribeUrl } from './unsubscribe'

interface MarketingHtmlArgs {
  bodyHtml: string
  preheader?: string | null
  unsubscribeToken: string
}

export function buildMarketingHtml({ bodyHtml, preheader, unsubscribeToken }: MarketingHtmlArgs): string {
  const url = unsubscribeUrl(unsubscribeToken)
  const footerExtra = `<p style="margin:0;">You're getting this because you signed up for Ba Studio. <a href="${url}" style="color:#c7c7cf;text-decoration:underline;">Unsubscribe</a>.</p>`
  return emailLayout({
    preheader: preheader && preheader.trim() ? preheader : 'News and tips from Ba Studio.',
    body: bodyHtml,
    footerExtra,
  })
}

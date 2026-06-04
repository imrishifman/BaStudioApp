import { cookies } from 'next/headers'
import { getDictionary } from '@/lib/i18n'
import { dirFor, LANG_COOKIE } from '@/lib/i18n/config'

export default async function VerifyRequestPage() {
  // No session yet here, so fall back to the language cookie the account picker
  // mirrors. Defaults to English when absent.
  const lang = (await cookies()).get(LANG_COOKIE)?.value
  const t = getDictionary(lang)
  return (
    <div dir={dirFor(lang)} className="flex min-h-screen flex-col items-center justify-center gap-4 text-center"
      style={{ background: 'var(--bg-0)', padding: '0 clamp(20px, 5vw, 80px)' }}>
      <p className="display-sm text-[var(--ink-1)]">{t.auth.checkEmail}</p>
      <p className="body-lg text-[var(--ink-2)]" style={{ maxWidth: '42ch' }}>
        {t.auth.magicLinkSent}
      </p>
    </div>
  )
}

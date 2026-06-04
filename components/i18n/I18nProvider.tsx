'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { makeT, type TFunc } from '@/lib/i18n'
import { dirFor, normalizeLang, type Lang } from '@/lib/i18n/config'

interface I18nValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: TFunc
}

const I18nContext = createContext<I18nValue | null>(null)

// Wraps the signed-in app. The server layout reads the user's saved language and
// passes it in; we build the translator once and expose it via context. We also
// reflect dir/lang onto <html> so native form controls, scrollbars, and text
// selection flip correctly, resetting to LTR/English on unmount so the (always
// English) marketing pages are never affected.
export function I18nProvider({
  lang: rawLang,
  children,
}: {
  lang: string
  children: React.ReactNode
}) {
  const lang = normalizeLang(rawLang)
  const dir = dirFor(lang)

  const value = useMemo<I18nValue>(() => ({ lang, dir, t: makeT(lang) }), [lang, dir])

  useEffect(() => {
    const html = document.documentElement
    const prevDir = html.getAttribute('dir')
    const prevLang = html.getAttribute('lang')
    html.setAttribute('dir', dir)
    html.setAttribute('lang', lang)
    return () => {
      html.setAttribute('dir', prevDir ?? 'ltr')
      html.setAttribute('lang', prevLang ?? 'en')
    }
  }, [dir, lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  // Default to English outside the provider (e.g. marketing) so components that
  // opt into t() still render rather than throwing.
  if (!ctx) return { lang: 'en', dir: 'ltr', t: makeT('en') }
  return ctx
}

// Convenience: const t = useT()
export function useT(): TFunc {
  return useI18n().t
}

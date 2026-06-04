// Supported UI / AI-output languages. English is the default; Hebrew is the
// opt-in right-to-left option a user can pick in Account settings. Marketing
// pages are intentionally NOT translated (always English).

export const LANGUAGES = ['en', 'he'] as const
export type Lang = (typeof LANGUAGES)[number]

export const DEFAULT_LANG: Lang = 'en'

// Human-readable labels for the language picker, each shown in its own script.
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  he: 'עברית',
}

// Languages that read right-to-left. Drives the `dir` attribute and layout flip.
const RTL_LANGS: Lang[] = ['he']

export function isRtl(lang: string | null | undefined): boolean {
  return RTL_LANGS.includes((lang ?? '') as Lang)
}

export function dirFor(lang: string | null | undefined): 'rtl' | 'ltr' {
  return isRtl(lang) ? 'rtl' : 'ltr'
}

// Normalize any stored/cookie value down to a supported Lang, defaulting safely.
export function normalizeLang(value: string | null | undefined): Lang {
  return (LANGUAGES as readonly string[]).includes(value ?? '')
    ? (value as Lang)
    : DEFAULT_LANG
}

// Cookie that mirrors the account preference so logged-out / pre-session screens
// (e.g. the email verify page) can render in the chosen language too.
export const LANG_COOKIE = 'ba_lang'

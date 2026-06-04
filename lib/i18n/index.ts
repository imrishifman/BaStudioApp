import { en, type Dict } from './dictionaries/en'
import { he } from './dictionaries/he'
import { normalizeLang, type Lang } from './config'

const DICTS: Record<Lang, Dict> = { en, he }

export function getDictionary(lang: string | null | undefined): Dict {
  return DICTS[normalizeLang(lang)]
}

// Dotted-path lookup into a dictionary, e.g. t('account.title'). Falls back to
// the English value, then to the key itself, so a missing translation degrades
// gracefully (mixed-language UI) instead of crashing.
export type TFunc = (key: string) => string

export function makeT(lang: string | null | undefined): TFunc {
  const dict = getDictionary(lang)
  return (key: string) => lookup(dict, key) ?? lookup(en, key) ?? key
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

export { type Dict } from './dictionaries/en'

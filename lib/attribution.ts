// Paid-traffic attribution capture.
//
// On any landing we read the Google click ids (gclid/gbraid/wbraid) and the UTM
// params off the URL and persist them in a 90-day first-party cookie. This gives
// us the click id at conversion time so a paid signup/subscription can later be
// matched back to the ad click via Google Ads OFFLINE CONVERSION IMPORT.
//
// The cookie is the source of truth on the client. Persisting the same data onto
// the user record (so the backend can run the offline upload) requires a DB
// schema change and is gated on owner approval — see persistAttributionToUser().

export const ATTRIBUTION_COOKIE = 'ba_attribution'
export const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60 // 90 days, in seconds

// Click ids that should always update to the most recent paid click, plus the
// UTM set. first_landing_url / captured_at are recorded once (first touch).
const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const

export const ATTRIBUTION_PARAM_KEYS = [...CLICK_ID_KEYS, ...UTM_KEYS] as const

export interface Attribution {
  gclid?: string
  gbraid?: string
  wbraid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  first_landing_url?: string
  captured_at?: string
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

// Returns the stored attribution, or null when nothing has been captured yet.
export function readAttribution(): Attribution | null {
  const raw = readCookie(ATTRIBUTION_COOKIE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Attribution
  } catch {
    return null
  }
}

// Reads the current URL and, if it carries any attribution params, writes/merges
// the 90-day cookie. Click ids and UTMs update to the latest paid click;
// first_landing_url and captured_at are preserved from the first capture. Safe to
// call on every landing — a no-op when no attribution params are present.
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const fresh: Attribution = {}
  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = params.get(key)
    if (value) fresh[key] = value
  }

  // Only persist when there is at least one real attribution signal.
  if (Object.keys(fresh).length === 0) return readAttribution()

  const existing = readAttribution() ?? {}
  const merged: Attribution = { ...existing, ...fresh }

  // First-touch fields: keep the original landing once recorded.
  merged.first_landing_url = existing.first_landing_url ?? window.location.href
  merged.captured_at = existing.captured_at ?? new Date().toISOString()

  document.cookie = [
    `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(merged))}`,
    'path=/',
    `max-age=${ATTRIBUTION_MAX_AGE}`,
    'samesite=lax',
  ].join('; ')

  return merged
}

// Merges the stored attribution params into a target URL's query string without
// clobbering params the URL already sets. Used to carry gclid/UTM through
// internal CTAs (e.g. landing-page → /?signin=1) so attribution survives the hop.
export function appendAttributionToUrl(url: string): string {
  const attribution = readAttribution()
  if (!attribution) return url

  // Resolve relative URLs against the current origin so URL() can parse them.
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://bastudiopodcast.com'
  const parsed = new URL(url, base)

  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = attribution[key]
    if (value && !parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, value)
    }
  }

  // Preserve the original shape: return a relative URL when we were given one.
  return url.startsWith('http') ? parsed.toString() : `${parsed.pathname}${parsed.search}`
}

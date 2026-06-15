import 'server-only'
import { GoogleAuth } from 'google-auth-library'

// Service-account auth for the SEO dashboard. We mint a short-lived access
// token from the service-account key and call the Search Console + GA4 Data
// REST APIs directly (lighter than the full SDKs). Read-only scopes.
//
// Env (never hardcode, never expose to the frontend):
//   GOOGLE_SERVICE_ACCOUNT_JSON  the key file, as raw JSON or base64 of the JSON
//   GSC_SITE_URL                 Search Console property, e.g. https://bastudiopodcast.com/
//   GA4_PROPERTY_ID              numeric GA4 property id, e.g. 123456789

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
]

// Thrown for missing/invalid config or denied access. The API layer turns these
// into a friendly message the admin UI can display, rather than a 500.
export class SeoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeoConfigError'
  }
}

interface ServiceAccount {
  client_email?: string
  private_key?: string
  [k: string]: unknown
}

function loadCredentials(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw || !raw.trim()) {
    throw new SeoConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is not set. Add the service-account key to enable Google data.')
  }
  let jsonStr = raw.trim()
  // Accept base64 of the JSON too (avoids newline mangling in some secret stores).
  if (!jsonStr.startsWith('{')) {
    try {
      jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8')
    } catch {
      /* fall through to JSON.parse, which will throw a clear error */
    }
  }
  try {
    return JSON.parse(jsonStr) as ServiceAccount
  } catch {
    throw new SeoConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (or base64 of JSON).')
  }
}

// Tokens are valid ~1h; cache for 50 min within a warm lambda.
let cached: { token: string; expiresAt: number } | null = null

export async function getGoogleAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const credentials = loadCredentials()
  const auth = new GoogleAuth({ credentials, scopes: SCOPES })
  const client = await auth.getClient()
  const res = await client.getAccessToken()
  const token = typeof res === 'string' ? res : res?.token
  if (!token) {
    throw new SeoConfigError('Could not obtain a Google access token from the service account key.')
  }
  cached = { token, expiresAt: Date.now() + 50 * 60_000 }
  return token
}

// The service-account email the owner must grant access to in GSC + GA4.
// Surfaced in error messages so the fix is obvious.
export function serviceAccountEmail(): string | null {
  try {
    return loadCredentials().client_email ?? null
  } catch {
    return null
  }
}

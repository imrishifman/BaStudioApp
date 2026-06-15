import 'server-only'
import { getGoogleAccessToken, serviceAccountEmail, SeoConfigError } from './google-auth'

// Google Search Console (Search Analytics API) client. Read-only.
// All calls go through a service-account access token; the property comes from
// GSC_SITE_URL.

const GSC_API = 'https://www.googleapis.com/webmasters/v3'

function siteUrl(): string {
  const s = process.env.GSC_SITE_URL
  if (!s || !s.trim()) {
    throw new SeoConfigError('GSC_SITE_URL is not set (e.g. https://bastudiopodcast.com/).')
  }
  return s.trim()
}

export interface GscRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscQueryBody {
  startDate: string
  endDate: string
  dimensions?: string[]
  rowLimit?: number
}

async function query(body: GscQueryBody): Promise<GscRow[]> {
  const token = await getGoogleAccessToken()
  const site = encodeURIComponent(siteUrl())
  const res = await fetch(`${GSC_API}/sites/${site}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    if (res.status === 403) {
      const email = serviceAccountEmail()
      throw new SeoConfigError(
        `Search Console access denied for ${siteUrl()}. Add ${email ?? 'the service-account email'} as a user under Settings > Users and permissions.`,
      )
    }
    if (res.status === 404) {
      throw new SeoConfigError(`Search Console property ${siteUrl()} not found. Check GSC_SITE_URL matches the property exactly.`)
    }
    throw new Error(`Search Console API error ${res.status}: ${txt.slice(0, 200)}`)
  }
  const json = (await res.json()) as { rows?: GscRow[] }
  return json.rows ?? []
}

export interface GscTotals {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export async function getTotals(startDate: string, endDate: string): Promise<GscTotals> {
  const rows = await query({ startDate, endDate })
  const r = rows[0]
  return {
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: r?.ctr ?? 0,
    position: r?.position ?? 0,
  }
}

export interface GscDayPoint {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export async function getTimeSeries(startDate: string, endDate: string): Promise<GscDayPoint[]> {
  const rows = await query({ startDate, endDate, dimensions: ['date'] })
  return rows
    .map((r) => ({
      date: r.keys?.[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface GscKeyedRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function topByDimension(
  startDate: string,
  endDate: string,
  dimension: 'query' | 'page',
  rowLimit = 25,
): Promise<GscKeyedRow[]> {
  const rows = await query({ startDate, endDate, dimensions: [dimension], rowLimit })
  return rows.map((r) => ({
    key: r.keys?.[0] ?? '',
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))
}

export const getTopQueries = (s: string, e: string, n = 25) => topByDimension(s, e, 'query', n)
export const getTopPages = (s: string, e: string, n = 25) => topByDimension(s, e, 'page', n)

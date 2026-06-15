import 'server-only'
import { getGoogleAccessToken, serviceAccountEmail, SeoConfigError } from './google-auth'

// Google Analytics 4 Data API (runReport) client. Read-only.
// Property comes from GA4_PROPERTY_ID (numeric).

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'

function propertyId(): string {
  const id = process.env.GA4_PROPERTY_ID
  if (!id || !id.trim()) {
    throw new SeoConfigError('GA4_PROPERTY_ID is not set (the numeric property id from GA4 Admin > Property Settings).')
  }
  return id.trim().replace(/^properties\//, '')
}

interface RunReportBody {
  dateRanges: { startDate: string; endDate: string }[]
  dimensions?: { name: string }[]
  metrics: { name: string }[]
  orderBys?: unknown[]
  limit?: number
  dimensionFilter?: unknown
}

interface Ga4Response {
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[]
}

async function runReport(body: RunReportBody): Promise<Ga4Response> {
  const token = await getGoogleAccessToken()
  const id = propertyId()
  const res = await fetch(`${GA4_API}/properties/${id}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    if (res.status === 403) {
      const email = serviceAccountEmail()
      throw new SeoConfigError(
        `GA4 access denied. Add ${email ?? 'the service-account email'} as a Viewer on property ${id} (GA4 Admin > Property Access Management).`,
      )
    }
    if (res.status === 404) {
      throw new SeoConfigError(`GA4 property ${id} not found. Check GA4_PROPERTY_ID.`)
    }
    throw new Error(`GA4 Data API error ${res.status}: ${txt.slice(0, 200)}`)
  }
  return (await res.json()) as Ga4Response
}

const num = (v?: string) => (v ? Number(v) : 0)

export interface Ga4DayPoint {
  date: string
  sessions: number
  users: number
}

export async function getSessionsOverTime(startDate: string, endDate: string): Promise<Ga4DayPoint[]> {
  const r = await runReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  })
  return (r.rows ?? []).map((row) => {
    const d = row.dimensionValues?.[0]?.value ?? ''
    // GA4 returns date as YYYYMMDD; normalise to YYYY-MM-DD.
    const date = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d
    return { date, sessions: num(row.metricValues?.[0]?.value), users: num(row.metricValues?.[1]?.value) }
  })
}

export interface Ga4SourceRow {
  sourceMedium: string
  sessions: number
}

export async function getTrafficBySourceMedium(startDate: string, endDate: string, limit = 25): Promise<Ga4SourceRow[]> {
  const r = await runReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  })
  return (r.rows ?? []).map((row) => ({
    sourceMedium: row.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: num(row.metricValues?.[0]?.value),
  }))
}

// AI assistants show up as referral sources. Configurable default list; the
// dashboard isolates sessions whose sessionSource matches one of these so the
// owner can see, e.g., the first visit from ChatGPT.
export const AI_ASSISTANT_SOURCES = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'claude.ai',
]

export interface AiReferral {
  total: number
  perSource: { source: string; sessions: number }[]
  series: { date: string; sessions: number }[]
}

export async function getAiAssistantTraffic(startDate: string, endDate: string): Promise<AiReferral> {
  const aiFilter = {
    filter: { fieldName: 'sessionSource', inListFilter: { values: AI_ASSISTANT_SOURCES } },
  }
  const [bySource, byDate] = await Promise.all([
    runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: aiFilter,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: aiFilter,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
  ])
  const perSource = (bySource.rows ?? []).map((r) => ({
    source: r.dimensionValues?.[0]?.value ?? '(unknown)',
    sessions: num(r.metricValues?.[0]?.value),
  }))
  const series = (byDate.rows ?? []).map((r) => {
    const d = r.dimensionValues?.[0]?.value ?? ''
    const date = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d
    return { date, sessions: num(r.metricValues?.[0]?.value) }
  })
  return { total: perSource.reduce((s, x) => s + x.sessions, 0), perSource, series }
}

export interface Ga4PageRow {
  page: string
  sessions: number
}

export async function getTopLandingPages(startDate: string, endDate: string, limit = 25): Promise<Ga4PageRow[]> {
  const r = await runReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  })
  return (r.rows ?? []).map((row) => ({
    page: row.dimensionValues?.[0]?.value ?? '(not set)',
    sessions: num(row.metricValues?.[0]?.value),
  }))
}

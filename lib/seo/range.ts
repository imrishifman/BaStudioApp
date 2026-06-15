// Date-range helper shared by the SEO clients and API routes. The dashboard
// offers Last 24h / 7 days / 28 days; we also expose the immediately prior
// period of equal length for comparison in the daily report.

export type SeoRangeKey = '1d' | '7d' | '28d'

export const SEO_RANGE_DAYS: Record<SeoRangeKey, number> = { '1d': 1, '7d': 7, '28d': 28 }

export function parseRange(value: string | null | undefined): SeoRangeKey {
  return value === '1d' || value === '7d' || value === '28d' ? value : '28d'
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Returns YYYY-MM-DD bounds for the current period and the prior period of the
// same length, both ending "today". (Search Console data lags ~2-3 days; the
// API simply returns what it has, so we don't special-case the end date.)
export function rangeDates(key: SeoRangeKey): {
  startDate: string
  endDate: string
  prevStartDate: string
  prevEndDate: string
} {
  const days = SEO_RANGE_DAYS[key]
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const prevEnd = new Date(start)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1))
  return {
    startDate: iso(start),
    endDate: iso(end),
    prevStartDate: iso(prevStart),
    prevEndDate: iso(prevEnd),
  }
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, MousePointerClick, Eye, Percent, ArrowDownUp, AlertTriangle, ChevronLeft } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'

// Admin SEO & Traffic dashboard. English-only labels by design (internal admin
// tool). Calls the Phase-1 admin API endpoints; never talks to Google directly.

type RangeKey = '1d' | '7d' | '28d'
const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1d', label: 'Last 24h' },
  { key: '7d', label: '7 days' },
  { key: '28d', label: '28 days' },
]

interface GscKeyed { key: string; clicks: number; impressions: number; ctr: number; position: number }
interface ScData {
  error?: string
  totals?: { clicks: number; impressions: number; ctr: number; position: number }
  timeSeries?: { date: string; clicks: number; impressions: number }[]
  topQueries?: GscKeyed[]
  topPages?: GscKeyed[]
}
interface GaData {
  error?: string
  sessions?: { date: string; sessions: number; users: number }[]
  sources?: { sourceMedium: string; sessions: number }[]
  landingPages?: { page: string; sessions: number }[]
}

const nf = new Intl.NumberFormat('en-US')
const pct = (n: number) => `${(n * 100).toFixed(2)}%`

export function SeoClient() {
  const [range, setRange] = useState<RangeKey>('28d')
  const [sc, setSc] = useState<ScData | null>(null)
  const [ga, setGa] = useState<GaData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true)
    try {
      const [scRes, gaRes] = await Promise.all([
        fetch(`/api/admin/seo/search-console?range=${r}`, { cache: 'no-store' }).then((x) => x.json()),
        fetch(`/api/admin/seo/analytics?range=${r}`, { cache: 'no-store' }).then((x) => x.json()),
      ])
      setSc(scRes)
      setGa(gaRes)
    } catch {
      setSc({ error: 'Failed to reach the server. Please try again.' })
      setGa({ error: 'Failed to reach the server. Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  // Merge GSC (clicks/impressions) and GA4 (sessions) into one date-keyed series.
  const byDate = new Map<string, { date: string; clicks: number; impressions: number; sessions: number }>()
  for (const p of sc?.timeSeries ?? []) byDate.set(p.date, { date: p.date, clicks: p.clicks, impressions: p.impressions, sessions: 0 })
  for (const p of ga?.sessions ?? []) {
    const row = byDate.get(p.date) ?? { date: p.date, clicks: 0, impressions: 0, sessions: 0 }
    row.sessions = p.sessions
    byDate.set(p.date, row)
  }
  const chartData = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const maxSource = Math.max(1, ...(ga?.sources ?? []).map((s) => s.sessions))

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-[var(--ink-3)] hover:text-[var(--ink-1)]"><ChevronLeft size={18} /></Link>
          <TrendingUp size={18} style={{ color: 'var(--accent-violet)' }} />
          <h1 className="display-sm text-[var(--ink-1)]">SEO &amp; Traffic</h1>
        </div>
        {/* Date-range selector drives every widget. */}
        <div className="flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)' }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
              style={range === r.key ? { background: 'var(--bg-3)', color: 'var(--ink-1)' } : { color: 'var(--ink-3)' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !sc && !ga ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
        </div>
      ) : (
        <div className="space-y-6" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {/* KPI cards (Search Console) */}
          {sc?.error ? (
            <ErrorCard title="Search Console" message={sc.error} />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={<MousePointerClick size={16} />} label="Total clicks" value={nf.format(sc?.totals?.clicks ?? 0)} />
              <Kpi icon={<Eye size={16} />} label="Total impressions" value={nf.format(sc?.totals?.impressions ?? 0)} />
              <Kpi icon={<Percent size={16} />} label="Average CTR" value={pct(sc?.totals?.ctr ?? 0)} />
              <Kpi icon={<ArrowDownUp size={16} />} label="Average position" value={(sc?.totals?.position ?? 0).toFixed(1)} />
            </div>
          )}

          {/* Traffic over time */}
          <GlassCard className="p-5">
            <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Traffic over time</h2>
            {chartData.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line-1)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--ink-3)', fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} minTickGap={24} />
                  <YAxis tick={{ fill: 'var(--ink-3)', fontSize: 11 }} width={44} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 12, color: 'var(--ink-1)' }}
                    labelStyle={{ color: 'var(--ink-2)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="clicks" name="Clicks" stroke="#FF5C3C" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="impressions" name="Impressions" stroke="#A78BFA" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sessions" name="Sessions (GA4)" stroke="#67E8F9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Traffic by source / medium (GA4) */}
          <GlassCard className="p-5">
            <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Traffic by source / medium (GA4)</h2>
            {ga?.error ? (
              <InlineError message={ga.error} />
            ) : (ga?.sources?.length ?? 0) === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-2">
                {ga!.sources!.slice(0, 12).map((s) => (
                  <div key={s.sourceMedium} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 truncate body-sm text-[var(--ink-2)]" title={s.sourceMedium}>{s.sourceMedium}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(s.sessions / maxSource) * 100}%`, background: 'var(--accent-violet)' }} />
                    </div>
                    <div className="w-16 shrink-0 text-right body-sm text-[var(--ink-1)]">{nf.format(s.sessions)}</div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DataTable title="Top queries (Search Console)" error={sc?.error} rows={sc?.topQueries} kind="gsc" />
            <DataTable title="Top pages (Search Console)" error={sc?.error} rows={sc?.topPages} kind="gsc" />
          </div>
          <GaPagesTable error={ga?.error} rows={ga?.landingPages} />
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[var(--ink-3)]">{icon}<span className="body-sm">{label}</span></div>
      <div className="display-sm text-[var(--ink-1)]">{value}</div>
    </GlassCard>
  )
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <GlassCard className="flex items-start gap-3 p-4" >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
      <div>
        <p className="body font-semibold text-[var(--ink-1)]">{title} not connected</p>
        <p className="body-sm mt-1 text-[var(--ink-2)]">{message}</p>
      </div>
    </GlassCard>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
      <p className="body-sm text-[var(--ink-2)]">{message}</p>
    </div>
  )
}

function Empty() {
  return <p className="body-sm py-6 text-center text-[var(--ink-3)]">No data for this period yet.</p>
}

function DataTable({ title, error, rows, kind }: { title: string; error?: string; rows?: GscKeyed[]; kind: 'gsc' }) {
  return (
    <GlassCard className="p-5">
      <h2 className="body font-semibold text-[var(--ink-1)] mb-4">{title}</h2>
      {error ? <InlineError message={error} /> : (rows?.length ?? 0) === 0 ? <Empty /> : (
        <div className="overflow-x-auto">
          <table className="w-full body-sm">
            <thead>
              <tr className="text-[var(--ink-3)]">
                <th className="py-1 text-left font-medium"> </th>
                <th className="py-1 text-right font-medium">Clicks</th>
                <th className="py-1 text-right font-medium">Impr.</th>
                <th className="py-1 text-right font-medium">CTR</th>
                <th className="py-1 text-right font-medium">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {rows!.slice(0, 15).map((r) => (
                <tr key={r.key} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                  <td className="max-w-[220px] truncate py-1.5 text-[var(--ink-1)]" title={r.key}>{r.key || '(unknown)'}</td>
                  <td className="py-1.5 text-right text-[var(--ink-2)]">{nf.format(r.clicks)}</td>
                  <td className="py-1.5 text-right text-[var(--ink-2)]">{nf.format(r.impressions)}</td>
                  <td className="py-1.5 text-right text-[var(--ink-2)]">{pct(r.ctr)}</td>
                  <td className="py-1.5 text-right text-[var(--ink-2)]">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

function GaPagesTable({ error, rows }: { error?: string; rows?: { page: string; sessions: number }[] }) {
  return (
    <GlassCard className="p-5">
      <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Top landing pages (GA4)</h2>
      {error ? <InlineError message={error} /> : (rows?.length ?? 0) === 0 ? <Empty /> : (
        <div className="overflow-x-auto">
          <table className="w-full body-sm">
            <thead>
              <tr className="text-[var(--ink-3)]">
                <th className="py-1 text-left font-medium">Landing page</th>
                <th className="py-1 text-right font-medium">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {rows!.slice(0, 15).map((r) => (
                <tr key={r.page} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                  <td className="max-w-[480px] truncate py-1.5 text-[var(--ink-1)]" title={r.page}>{r.page || '(not set)'}</td>
                  <td className="py-1.5 text-right text-[var(--ink-2)]">{nf.format(r.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

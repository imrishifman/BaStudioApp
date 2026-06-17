'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, MousePointerClick, Eye, Percent, ArrowDownUp, AlertTriangle, ChevronLeft, Sparkles, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'

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
  aiReferrals?: { total: number; perSource: { source: string; sessions: number }[]; series: { date: string; sessions: number }[] }
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
          {/* Live "visitors right now" (GA4 Realtime). Polls independently. */}
          <RealtimeWidget />

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

          {/* AI Assistant Traffic (GA4, filtered to assistant sources) */}
          <GlassCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--accent-violet)' }} />
              <h2 className="body font-semibold text-[var(--ink-1)]">AI assistant traffic</h2>
              {ga?.aiReferrals && <span className="body-sm text-[var(--ink-3)]">{nf.format(ga.aiReferrals.total)} sessions</span>}
            </div>
            {ga?.error ? (
              <InlineError message={ga.error} />
            ) : (ga?.aiReferrals?.perSource?.length ?? 0) === 0 ? (
              <p className="body-sm py-2 text-[var(--ink-3)]">No visits from ChatGPT, Perplexity, Gemini, Copilot, or Claude in this period yet.</p>
            ) : (
              <div className="space-y-2">
                {ga!.aiReferrals!.perSource.map((s) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 truncate body-sm text-[var(--ink-2)]">{s.source}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(s.sessions / Math.max(1, ...ga!.aiReferrals!.perSource.map((x) => x.sessions))) * 100}%`, background: 'var(--accent-cyan)' }} />
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

          {/* Daily AI report */}
          <DailyReport />
        </div>
      )}
    </div>
  )
}

// Daily AI report section: shows the latest report, a history list, and a
// "Run report now" button. Self-contained (own fetch/state).
function DailyReport() {
  const [reports, setReports] = useState<{ id: string; content: string; emailed: boolean; createdAt: string }[]>([])
  const [running, setRunning] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    try {
      const j = await fetch('/api/admin/seo/reports', { cache: 'no-store' }).then((x) => x.json())
      setReports(j.reports ?? [])
      if (j.reports?.[0]) setOpenId(j.reports[0].id)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { loadReports() }, [loadReports])

  async function runNow() {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/seo/reports', { method: 'POST' })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error ?? 'Could not generate the report'); return }
      toast.success('Report generated')
      await loadReports()
    } catch {
      toast.error('Could not generate the report')
    } finally {
      setRunning(false)
    }
  }

  const open = reports.find((r) => r.id === openId) ?? reports[0]

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="body font-semibold text-[var(--ink-1)]">Daily report</h2>
        <PillButton size="sm" onClick={runNow} disabled={running}>
          <RefreshCw size={13} className={running ? 'animate-spin' : ''} /> {running ? 'Generating…' : 'Run report now'}
        </PillButton>
      </div>
      {reports.length === 0 ? (
        <p className="body-sm py-2 text-[var(--ink-3)]">No reports yet. Click "Run report now" to generate the first one (or it runs automatically each day).</p>
      ) : (
        <>
          {open && (
            <article className="space-y-1 body-sm text-[var(--ink-2)]">
              {open.content.split('\n').map((line, i) => {
                const h = line.match(/^#{2,}\s+(.*)/)
                if (h) return <h3 key={i} className="body mt-3 font-semibold text-[var(--ink-1)]">{h[1]}</h3>
                const li = line.match(/^[-*]\s+(.*)/)
                if (li) return <div key={i} className="flex gap-2"><span className="text-[var(--accent-violet)]">•</span><span>{li[1].replace(/\*\*/g, '')}</span></div>
                if (!line.trim()) return null
                return <p key={i}>{line.replace(/\*\*/g, '')}</p>
              })}
            </article>
          )}
          {reports.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--line-1)' }}>
              <span className="body-sm text-[var(--ink-3)]">History:</span>
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="body-sm rounded-full px-2 py-0.5"
                  style={r.id === open?.id ? { background: 'var(--bg-3)', color: 'var(--ink-1)' } : { color: 'var(--ink-3)' }}
                >
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </GlassCard>
  )
}

// Live visitors-right-now card. Polls /api/admin/seo/realtime every 20s and
// shows the active-user count plus a small per-country breakdown. Degrades to a
// muted dash if GA4 isn't connected.
function RealtimeWidget() {
  const [data, setData] = useState<{ activeUsers: number; byCountry: { country: string; activeUsers: number }[] } | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const j = await fetch('/api/admin/seo/realtime', { cache: 'no-store' }).then((x) => x.json())
        if (!alive) return
        if (j && typeof j.activeUsers === 'number') { setData(j); setUnavailable(false) }
        else setUnavailable(true)
      } catch {
        if (alive) setUnavailable(true)
      }
    }
    load()
    const id = setInterval(load, 20_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const live = !unavailable && (data?.activeUsers ?? 0) > 0

  return (
    <GlassCard className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          {live && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: 'var(--success)' }} />
          )}
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: unavailable ? 'var(--ink-4)' : 'var(--success)' }} />
        </span>
        <div>
          <p className="body-sm text-[var(--ink-3)]">Visitors right now</p>
          <p className="display-sm leading-tight text-[var(--ink-1)]">
            {unavailable ? '—' : data ? nf.format(data.activeUsers) : '…'}
          </p>
        </div>
      </div>
      {!unavailable && data && data.byCountry.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.byCountry.slice(0, 5).map((c) => (
            <span key={c.country} className="rounded-full px-2.5 py-1 body-sm" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
              {c.country} · {nf.format(c.activeUsers)}
            </span>
          ))}
        </div>
      )}
      <span className="ml-auto body-sm text-[var(--ink-4)]">{unavailable ? 'Realtime unavailable' : 'Live · last 30 min'}</span>
    </GlassCard>
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

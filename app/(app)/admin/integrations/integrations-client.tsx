'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plug, ChevronLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, MinusCircle, Coins, ExternalLink } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'

// Admin Integrations / token-status view. English-only by design (internal
// admin tool). Reads /api/admin/integrations; shows presence/validity/expiry
// for every third party, never any secret value.

type Status = 'ok' | 'configured' | 'expiring' | 'expired' | 'error' | 'not_configured'

interface Integration {
  key: string
  name: string
  category: string
  status: Status
  detail: string
  expiresAt?: string | null
  daysLeft?: number | null
  balance?: string | null
  dashboardUrl?: string | null
  live: boolean
}

const META: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ok: { label: 'Connected', color: 'var(--success)', icon: CheckCircle2 },
  configured: { label: 'Configured', color: 'var(--accent-cyan)', icon: CheckCircle2 },
  expiring: { label: 'Expiring soon', color: 'var(--warning)', icon: Clock },
  expired: { label: 'Expired', color: 'var(--error)', icon: XCircle },
  error: { label: 'Error', color: 'var(--error)', icon: AlertTriangle },
  not_configured: { label: 'Not set', color: 'var(--ink-4)', icon: MinusCircle },
}

const CATEGORY_ORDER = ['Database', 'Payments', 'AI', 'Analytics', 'Email', 'Social', 'Messaging', 'Infrastructure', 'Enrichment', 'Auth']

export function IntegrationsClient() {
  const [items, setItems] = useState<Integration[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const j = await fetch('/api/admin/integrations', { cache: 'no-store' }).then((x) => x.json())
      if (j.error) setError(j.error)
      else {
        setItems(j.integrations)
        setFetchedAt(j.fetchedAt)
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const attention = (items ?? []).filter((i) => i.status === 'error' || i.status === 'expired' || i.status === 'expiring')
  const categories = CATEGORY_ORDER.filter((c) => (items ?? []).some((i) => i.category === c))

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-[var(--ink-3)] hover:text-[var(--ink-1)]"><ChevronLeft size={18} /></Link>
          <Plug size={18} style={{ color: 'var(--accent-violet)' }} />
          <h1 className="display-sm text-[var(--ink-1)]">Integrations</h1>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="body-sm text-[var(--ink-4)]">Checked {new Date(fetchedAt).toLocaleTimeString()}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 body-sm rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)] disabled:opacity-50"
            style={{ borderColor: 'var(--line-2)' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <GlassCard className="flex items-start gap-3 p-4 mb-6">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
          <p className="body-sm text-[var(--ink-2)]">{error}</p>
        </GlassCard>
      )}

      {loading && !items ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
        </div>
      ) : items ? (
        <div className="space-y-6" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          {/* Attention banner */}
          {attention.length > 0 && (
            <GlassCard className="p-4" style={{ borderColor: 'var(--warning)' }}>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                <p className="body font-semibold text-[var(--ink-1)]">{attention.length} need{attention.length === 1 ? 's' : ''} attention</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {attention.map((i) => (
                  <span key={i.key} className="body-sm rounded-full px-2.5 py-0.5" style={{ background: 'var(--bg-3)', color: META[i.status].color }}>
                    {i.name} · {META[i.status].label}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {categories.map((cat) => (
            <div key={cat}>
              <p className="eyebrow mb-3 text-[var(--ink-3)]">{cat}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.filter((i) => i.category === cat).map((i) => {
                  const m = META[i.status]
                  const Icon = m.icon
                  return (
                    <GlassCard key={i.key} className="flex items-start gap-3 p-4">
                      <Icon size={18} className="mt-0.5 shrink-0" style={{ color: m.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="body font-semibold text-[var(--ink-1)] truncate">{i.name}</p>
                          <span className="shrink-0 body-sm rounded-full px-2 py-0.5 font-semibold" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}>
                            {m.label}
                          </span>
                        </div>
                        <p className="body-sm mt-1 text-[var(--ink-2)]">{i.detail}</p>
                        {i.balance && (
                          <p className="body-sm mt-1.5 flex items-center gap-1.5 font-semibold text-[var(--ink-1)]">
                            <Coins size={13} style={{ color: 'var(--accent-violet)' }} /> {i.balance}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3">
                          {!i.live && i.status !== 'not_configured' && (
                            <span className="body-sm text-[var(--ink-4)]">Presence check (not live-verified)</span>
                          )}
                          {i.dashboardUrl && (
                            <a
                              href={i.dashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="body-sm inline-flex items-center gap-1 text-[var(--accent-violet)] hover:underline"
                            >
                              {i.balance ? 'Open dashboard' : 'Check usage in dashboard'} <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

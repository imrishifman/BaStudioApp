'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DollarSign, ChevronLeft, Download, Check, Plus, Link2 } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'

// Admin commissions dashboard. English-only (internal tool). Reads server-fetched
// props; mutations POST to /api/admin/commissions then refresh.

interface Config {
  callerRate: number; callerDurationMonths: number; studioRate: number
  studioDurationMonths: number | null; bonusAmount: number; bonusPerNStudios: number
}
interface Summary { referredGross: number; fees: number; studioOwed: number; callerOwed: number; bonusOwed: number; liabilityPending: number; net: number }
interface Payout { recipientType: 'studio' | 'caller'; recipientId: string; period: string; amount: number; name: string }
interface CallerRow { id: string; name: string; email: string; status: string; studioCount: number; activatedCount: number }
interface StudioRow { id: string; name: string; couponCode: string | null; callerId: string | null; activated: boolean; status: string }

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

export function CommissionsClient({ period, config, summary, payouts, callers, studios }: {
  period: string; config: Config; summary: Summary; payouts: Payout[]; callers: CallerRow[]; studios: StudioRow[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [newCaller, setNewCaller] = useState({ name: '', email: '', contact: '' })
  const [cfg, setCfg] = useState<Config>(config)

  async function post(action: string, payload: Record<string, unknown>, key: string) {
    setBusy(key)
    try {
      const res = await fetch('/api/admin/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Something went wrong'); return false }
      router.refresh()
      return true
    } catch {
      toast.error('Could not reach the server')
      return false
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-[var(--ink-3)] hover:text-[var(--ink-1)]"><ChevronLeft size={18} /></Link>
          <DollarSign size={18} style={{ color: 'var(--accent-violet)' }} />
          <h1 className="display-sm text-[var(--ink-1)]">Commissions</h1>
          <span className="body-sm text-[var(--ink-4)]">{period}</span>
        </div>
        <a href="/api/admin/commissions/export" className="flex items-center gap-1.5 body-sm rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)]" style={{ borderColor: 'var(--line-2)' }}>
          <Download size={13} /> Export CSV
        </a>
      </div>

      {/* Metrics (this period, referred revenue) */}
      <div>
        <p className="eyebrow mb-3 text-[var(--ink-3)]">This month (referred)</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Referred gross', value: usd(summary.referredGross) },
            { label: 'Pending liability', value: usd(summary.liabilityPending) },
            { label: 'Studio owed', value: usd(summary.studioOwed) },
            { label: 'Caller owed', value: usd(summary.callerOwed) },
            { label: 'Bonuses', value: usd(summary.bonusOwed) },
            { label: 'Stripe fees', value: usd(summary.fees) },
            { label: 'Net after commissions', value: usd(summary.net) },
          ].map((m) => (
            <GlassCard key={m.label} className="p-4">
              <p className="body-sm text-[var(--ink-3)]">{m.label}</p>
              <p className="display-sm mt-1 text-[var(--ink-1)]">{m.value}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Pending payouts */}
      <GlassCard className="p-5">
        <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Pending payouts</h2>
        {payouts.length === 0 ? (
          <p className="body-sm py-2 text-[var(--ink-3)]">Nothing pending.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full body-sm">
              <thead><tr className="text-[var(--ink-3)]">
                <th className="py-1 text-left font-medium">Recipient</th>
                <th className="py-1 text-left font-medium">Type</th>
                <th className="py-1 text-left font-medium">Period</th>
                <th className="py-1 text-right font-medium">Amount</th>
                <th className="py-1 text-right font-medium"> </th>
              </tr></thead>
              <tbody>
                {payouts.map((p) => {
                  const key = `${p.recipientType}:${p.recipientId}:${p.period}`
                  return (
                    <tr key={key} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                      <td className="py-2 text-[var(--ink-1)]">{p.name}</td>
                      <td className="py-2 text-[var(--ink-3)] capitalize">{p.recipientType}</td>
                      <td className="py-2 text-[var(--ink-3)]">{p.period}</td>
                      <td className="py-2 text-right text-[var(--ink-1)]">{usd(p.amount)}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => post('mark-paid', { recipientType: p.recipientType, recipientId: p.recipientId, period: p.period }, key)}
                          disabled={busy === key}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 body-sm font-semibold disabled:opacity-50"
                          style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)', color: 'var(--success)' }}
                        >
                          <Check size={12} /> Mark paid
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Callers */}
      <GlassCard className="p-5">
        <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Callers</h2>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="space-y-1"><label className="body-sm text-[var(--ink-3)]">Name</label>
            <Input value={newCaller.name} onChange={(e) => setNewCaller((s) => ({ ...s, name: e.target.value }))} className="w-40 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" /></div>
          <div className="space-y-1"><label className="body-sm text-[var(--ink-3)]">Email</label>
            <Input value={newCaller.email} onChange={(e) => setNewCaller((s) => ({ ...s, email: e.target.value }))} placeholder="caller@email.com" className="w-52 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" /></div>
          <PillButton size="sm" disabled={busy === 'new-caller' || !newCaller.name.trim() || !newCaller.email.trim()}
            onClick={async () => { if (await post('create-caller', newCaller, 'new-caller')) setNewCaller({ name: '', email: '', contact: '' }) }}>
            <Plus size={14} /> Add caller
          </PillButton>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
          {callers.length === 0 && <p className="body-sm text-[var(--ink-3)]">No callers yet.</p>}
          {callers.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="body-sm font-medium text-[var(--ink-1)]">{c.name} <span className="text-[var(--ink-4)]">· {c.email}</span></p>
                <p className="body-sm text-[var(--ink-3)]">{c.studioCount} studios · {c.activatedCount} activated · {c.activatedCount % cfg.bonusPerNStudios}/{cfg.bonusPerNStudios} to next bonus</p>
              </div>
              <span className="body-sm rounded-full px-2 py-0.5" style={{ background: 'var(--bg-3)', color: c.status === 'active' ? 'var(--success)' : 'var(--ink-4)' }}>{c.status}</span>
              <button onClick={() => post('update-caller', { id: c.id, status: c.status === 'active' ? 'inactive' : 'active' }, `caller-${c.id}`)} disabled={busy === `caller-${c.id}`} className="body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] disabled:opacity-50">
                {c.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Studios → caller assignment */}
      <GlassCard className="p-5">
        <h2 className="body font-semibold text-[var(--ink-1)] mb-4 flex items-center gap-2"><Link2 size={15} /> Studios → caller</h2>
        <div className="overflow-x-auto">
          <table className="w-full body-sm">
            <thead><tr className="text-[var(--ink-3)]">
              <th className="py-1 text-left font-medium">Studio</th>
              <th className="py-1 text-left font-medium">Code</th>
              <th className="py-1 text-left font-medium">Activated</th>
              <th className="py-1 text-left font-medium">Caller</th>
            </tr></thead>
            <tbody>
              {studios.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                  <td className="py-2 text-[var(--ink-1)]">{s.name}</td>
                  <td className="py-2 font-mono text-[var(--ink-3)]">{s.couponCode ?? '-'}</td>
                  <td className="py-2 text-[var(--ink-3)]">{s.activated ? 'Yes' : 'No'}</td>
                  <td className="py-2">
                    <select
                      value={s.callerId ?? ''}
                      onChange={(e) => post('assign', { studioId: s.id, callerId: e.target.value || null }, `assign-${s.id}`)}
                      disabled={busy === `assign-${s.id}`}
                      className="h-8 rounded-md px-2 body-sm" style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}>
                      <option value="">(unassigned)</option>
                      {callers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Config */}
      <GlassCard className="p-5">
        <h2 className="body font-semibold text-[var(--ink-1)] mb-1">Commission config</h2>
        <p className="body-sm text-[var(--ink-3)] mb-4">Changes apply to future events only (past events keep their snapshotted rate).</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <NumField label="Studio rate %" value={cfg.studioRate * 100} onChange={(v) => setCfg((c) => ({ ...c, studioRate: (v ?? 0) / 100 }))} />
          <NumField label="Studio months (blank = ∞)" value={cfg.studioDurationMonths ?? ''} onChange={(v) => setCfg((c) => ({ ...c, studioDurationMonths: v }))} />
          <NumField label="Caller rate %" value={cfg.callerRate * 100} onChange={(v) => setCfg((c) => ({ ...c, callerRate: (v ?? 0) / 100 }))} />
          <NumField label="Caller months" value={cfg.callerDurationMonths} onChange={(v) => setCfg((c) => ({ ...c, callerDurationMonths: v ?? 0 }))} />
          <NumField label="Bonus amount $" value={cfg.bonusAmount} onChange={(v) => setCfg((c) => ({ ...c, bonusAmount: v ?? 0 }))} />
          <NumField label="Bonus per N studios" value={cfg.bonusPerNStudios} onChange={(v) => setCfg((c) => ({ ...c, bonusPerNStudios: v ?? 0 }))} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PillButton size="sm" disabled={busy === 'config'} onClick={() => post('update-config', { config: cfg }, 'config')}>Save config</PillButton>
          <span className="body-sm text-[var(--ink-4)]">Currently: studio {pct(config.studioRate)}, caller {pct(config.callerRate)} for {config.callerDurationMonths}mo, ${config.bonusAmount}/{config.bonusPerNStudios} studios</span>
        </div>
      </GlassCard>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number | string; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <label className="body-sm text-[var(--ink-3)]">{label}</label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
    </div>
  )
}

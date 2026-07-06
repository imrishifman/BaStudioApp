'use client'

import { Phone, TrendingUp, Gift } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'

// Caller portal. Read-only, all data pre-scoped on the server to this caller
// (no ids in the URL, no other caller's data reachable).

interface Config { bonusPerNStudios: number; bonusAmount: number; callerDurationMonths: number; callerRate: number }
interface Earnings { thisMonth: number; total: number; pending: number; history: { period: string; amount: number }[] }
interface Studio { id: string; name: string; code: string | null; activated: boolean; status: string; referred: number; active: number }
interface UserRow { token: string; studio: string; plan: string; status: string; signupDate: string | null; inWindow: boolean }

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export function CallerClient({ name, config, earnings, studios, bonus, windowCounts, users }: {
  name: string; config: Config; earnings: Earnings
  studios: Studio[]; bonus: { activatedCount: number; toNext: number; perN: number }; windowCounts: { inWindow: number; expired: number }; users: UserRow[]
}) {
  const remaining = bonus.perN > 0 ? (bonus.perN - bonus.toNext) % bonus.perN : 0
  const progressPct = bonus.perN > 0 ? (bonus.toNext / bonus.perN) * 100 : 0

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Phone size={18} style={{ color: 'var(--accent-violet)' }} />
        <h1 className="display-sm text-[var(--ink-1)]">Caller · {name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'This month', value: usd(earnings.thisMonth) },
          { label: 'Total earned', value: usd(earnings.total) },
          { label: 'Pending', value: usd(earnings.pending) },
          { label: 'Active studios', value: String(studios.filter((s) => s.status === 'active').length) },
        ].map((m) => (
          <GlassCard key={m.label} className="p-4">
            <p className="body-sm text-[var(--ink-3)]">{m.label}</p>
            <p className="display-sm mt-1 text-[var(--ink-1)]">{m.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Bonus tracker */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Gift size={16} style={{ color: 'var(--accent-violet)' }} />
          <h2 className="body font-semibold text-[var(--ink-1)]">Bonus tracker</h2>
        </div>
        <p className="body-sm text-[var(--ink-2)]">
          {bonus.activatedCount} activated studios · {remaining === 0 && bonus.toNext === 0 ? `${bonus.perN}` : remaining}
          {' '}more to your next {usd(config.bonusAmount)} bonus ({bonus.toNext}/{bonus.perN}).
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'var(--accent-violet)' }} />
        </div>
      </GlassCard>

      {/* Studios */}
      <GlassCard className="p-5">
        <h2 className="body font-semibold text-[var(--ink-1)] mb-4">Your studios</h2>
        {studios.length === 0 ? (
          <p className="body-sm text-[var(--ink-3)]">No studios assigned to you yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full body-sm">
              <thead><tr className="text-[var(--ink-3)]">
                <th className="py-1 text-left font-medium">Studio</th>
                <th className="py-1 text-left font-medium">Code</th>
                <th className="py-1 text-left font-medium">Status</th>
                <th className="py-1 text-right font-medium">Referred</th>
                <th className="py-1 text-right font-medium">Active</th>
              </tr></thead>
              <tbody>
                {studios.map((s) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                    <td className="py-2 text-[var(--ink-1)]">{s.name}</td>
                    <td className="py-2 font-mono text-[var(--ink-3)]">{s.code ?? '-'}</td>
                    <td className="py-2"><span style={{ color: s.activated ? 'var(--success)' : 'var(--ink-4)' }}>{s.activated ? 'Activated' : 'Signed'}</span></td>
                    <td className="py-2 text-right text-[var(--ink-2)]">{s.referred}</td>
                    <td className="py-2 text-right text-[var(--ink-2)]">{s.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Users in commission window */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} style={{ color: 'var(--accent-violet)' }} />
          <h2 className="body font-semibold text-[var(--ink-1)]">Commission window ({config.callerDurationMonths} months at {Math.round(config.callerRate * 1000) / 10}%)</h2>
        </div>
        <p className="body-sm text-[var(--ink-2)] mb-4">{windowCounts.inWindow} active users still earning · {windowCounts.expired} past the {config.callerDurationMonths}-month window.</p>
        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full body-sm">
              <thead><tr className="text-[var(--ink-3)]">
                <th className="py-1 text-left font-medium">User</th>
                <th className="py-1 text-left font-medium">Studio</th>
                <th className="py-1 text-left font-medium">Plan</th>
                <th className="py-1 text-left font-medium">Since</th>
                <th className="py-1 text-left font-medium">Window</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.token} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                    <td className="py-2 font-mono text-[var(--ink-2)]">{u.token}</td>
                    <td className="py-2 text-[var(--ink-2)]">{u.studio}</td>
                    <td className="py-2 text-[var(--ink-3)] capitalize">{u.plan}</td>
                    <td className="py-2 text-[var(--ink-3)]">{u.signupDate ?? '-'}</td>
                    <td className="py-2">
                      <span style={{ color: u.status !== 'active' ? 'var(--ink-4)' : u.inWindow ? 'var(--success)' : 'var(--warning)' }}>
                        {u.status !== 'active' ? u.status : u.inWindow ? 'In window' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {earnings.history.length > 0 && (
        <GlassCard className="p-5">
          <h2 className="body font-semibold text-[var(--ink-1)] mb-3">Earnings history</h2>
          <div className="flex flex-wrap gap-2">
            {earnings.history.map((h) => (
              <span key={h.period} className="body-sm rounded-full px-2.5 py-0.5" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                {h.period}: {usd(h.amount)}
              </span>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}

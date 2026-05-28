'use client'

import { useState, useEffect, useRef } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { PlanBadge } from '@/components/common/PlanBadge'
import { Users, Tag, BarChart2, Settings, MessageSquare, Heart, Lightbulb, AlertTriangle, Star, Activity, CheckCircle2, XCircle, DollarSign, Link2, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import type { User, CouponCode, UserFeedback } from '@prisma/client'

interface Props {
  users: User[]
  coupons: CouponCode[]
  feedback: UserFeedback[]
  stats: {
    totalUsers: number
    soloUsers: number
    masterUsers: number
    activeThisWeek: number
    totalEpisodes: number
    publishedEpisodes: number
    onboardingComplete: number
    neverActivated: number
    briefsSent: number
    socialGenerated: number
  }
}

type Tab = 'users' | 'coupons' | 'stats' | 'feedback' | 'system'

interface SystemStatus {
  fetchedAt: string
  subscriptions: { soloActive: number; masterActive: number; mrrDollars: number; arrDollars: number; canceledLast30: number }
  affiliate: {
    activeInfluencers: number
    clicksLast24h: number
    clicksTotal: number
    attributionsTotal: number
    conversionsThisMonth: number
    unpaidCommissionDollars: number
    topInfluencer: { name: string; conversions: number } | null
  }
  system: {
    db: { ok: boolean; error: string | null }
    env: Record<string, boolean>
    deploy: { uid?: string; state?: string; createdAt?: number; meta?: { githubCommitSha?: string; githubCommitMessage?: string; githubCommitAuthorName?: string }; url?: string } | { error: string } | null
  }
}

const FEEDBACK_META: Record<string, { color: string; icon: typeof Heart; label: string }> = {
  praise:     { color: 'var(--success)',     icon: Heart,         label: 'Praise' },
  review:     { color: 'var(--warning)',     icon: Star,          label: 'Review' },
  suggestion: { color: 'var(--accent-cyan)', icon: Lightbulb,     label: 'Suggestion' },
  complaint:  { color: 'var(--error)',       icon: AlertTriangle, label: 'Complaint' },
}

export function AdminClient({ users: initialUsers, coupons: initialCoupons, feedback, stats }: Props) {
  const [tab, setTab] = useState<Tab>('system')
  const [users, setUsers] = useState(initialUsers)
  const [coupons, setCoupons] = useState(initialCoupons)
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all')
  const [newCoupon, setNewCoupon] = useState({ code: '', applicablePlan: 'solo', discountValue: 100, maxUses: 1 })
  const [creating, setCreating] = useState(false)

  async function setPlan(userId: string, plan: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: plan as User['plan'] } : u))
      toast.success('Plan updated')
    }
  }

  async function createCoupon() {
    if (!newCoupon.code.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCoupon),
    })
    if (res.ok) {
      const c = await res.json()
      setCoupons(prev => [c, ...prev])
      setNewCoupon({ code: '', applicablePlan: 'solo', discountValue: 100, maxUses: 1 })
      toast.success('Coupon created')
    }
    setCreating(false)
  }

  async function deleteCoupon(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoupons(prev => prev.filter(c => c.id !== id))
      toast.success('Coupon deleted')
    }
  }

  const TABS = [
    { key: 'system' as Tab, label: 'System', icon: Activity },
    { key: 'users' as Tab, label: 'Users', icon: Users },
    { key: 'coupons' as Tab, label: 'Coupons', icon: Tag },
    { key: 'feedback' as Tab, label: `Feedback${feedback.length ? ` (${feedback.length})` : ''}`, icon: MessageSquare },
    { key: 'stats' as Tab, label: 'Stats', icon: BarChart2 },
  ]

  // System polling: refetch /api/admin/system-status every 30s while the tab is open.
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [secondsSinceFetch, setSecondsSinceFetch] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (tab !== 'system') return
    async function load() {
      try {
        const res = await fetch('/api/admin/system-status', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as SystemStatus
        setSystemStatus(json)
        setSecondsSinceFetch(0)
      } catch {
        // Silent - we'll try again next tick.
      }
    }
    load()
    fetchRef.current = setInterval(load, 30_000)
    tickRef.current = setInterval(() => setSecondsSinceFetch((s) => s + 1), 1_000)
    return () => {
      if (fetchRef.current) clearInterval(fetchRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [tab])

  const filteredFeedback = feedbackFilter === 'all'
    ? feedback
    : feedback.filter((f) => f.type === feedbackFilter)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Settings size={18} style={{ color: 'var(--accent-violet)' }} />
        <h1 className="display-sm text-[var(--ink-1)]">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
              style={tab === t.key
                ? { background: 'var(--bg-3)', color: 'var(--ink-1)' }
                : { color: 'var(--ink-3)' }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-6">
          {/* Refresh indicator */}
          <div className="flex items-center justify-between">
            <p className="body-sm text-[var(--ink-3)]">
              {systemStatus
                ? `Updated ${secondsSinceFetch}s ago · auto-refresh every 30s`
                : 'Loading…'}
            </p>
            <button
              onClick={async () => {
                const res = await fetch('/api/admin/system-status', { cache: 'no-store' })
                if (res.ok) { setSystemStatus(await res.json()); setSecondsSinceFetch(0) }
              }}
              className="body-sm rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              style={{ borderColor: 'var(--line-2)' }}
            >
              Refresh now
            </button>
          </div>

          {systemStatus && (
            <>
              {/* Subscriptions + revenue */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">Subscriptions & revenue</p>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  {[
                    { label: 'Solo active', value: systemStatus.subscriptions.soloActive },
                    { label: 'Master active', value: systemStatus.subscriptions.masterActive },
                    { label: 'MRR', value: `$${systemStatus.subscriptions.mrrDollars.toLocaleString()}` },
                    { label: 'ARR', value: `$${systemStatus.subscriptions.arrDollars.toLocaleString()}` },
                    { label: 'Cancels (30d)', value: systemStatus.subscriptions.canceledLast30 },
                  ].map((s) => (
                    <GlassCard key={s.label} className="p-4">
                      <p className="body-sm text-[var(--ink-3)]">{s.label}</p>
                      <p className="display-sm mt-1 text-[var(--ink-1)]">{s.value}</p>
                    </GlassCard>
                  ))}
                </div>
              </div>

              {/* Affiliate */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">Affiliate · live</p>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Active influencers', value: systemStatus.affiliate.activeInfluencers },
                    { label: 'Clicks (24h)', value: systemStatus.affiliate.clicksLast24h },
                    { label: 'Conversions this month', value: systemStatus.affiliate.conversionsThisMonth },
                    { label: 'Unpaid commission', value: `$${systemStatus.affiliate.unpaidCommissionDollars.toLocaleString()}` },
                  ].map((s) => (
                    <GlassCard key={s.label} className="p-4">
                      <p className="body-sm text-[var(--ink-3)]">{s.label}</p>
                      <p className="display-sm mt-1 text-[var(--ink-1)]">{s.value}</p>
                    </GlassCard>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--ink-3)]">
                  <p className="body-sm">Clicks all-time: <span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.clicksTotal.toLocaleString()}</span></p>
                  <p className="body-sm">Attributions: <span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.attributionsTotal.toLocaleString()}</span></p>
                  {systemStatus.affiliate.topInfluencer && (
                    <p className="body-sm">Top: <span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.topInfluencer.name}</span> ({systemStatus.affiliate.topInfluencer.conversions} conv.)</p>
                  )}
                </div>
              </div>

              {/* System health */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">System health</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* DB + env */}
                  <GlassCard className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Link2 size={14} className="text-[var(--ink-3)]" />
                      <p className="body font-semibold text-[var(--ink-1)]">Database</p>
                      {systemStatus.system.db.ok ? (
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                      ) : (
                        <XCircle size={14} style={{ color: 'var(--error)' }} />
                      )}
                    </div>
                    {systemStatus.system.db.error && (
                      <p className="body-sm text-[var(--error)] mb-3">{systemStatus.system.db.error}</p>
                    )}
                    <p className="eyebrow mb-2 text-[var(--ink-4)]">Env vars</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(systemStatus.system.env).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5 body-sm">
                          {v ? (
                            <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                          ) : (
                            <XCircle size={12} style={{ color: 'var(--error)' }} />
                          )}
                          <span className={v ? 'text-[var(--ink-2)]' : 'text-[var(--ink-4)]'}>{k}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Deployment */}
                  <GlassCard className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <GitBranch size={14} className="text-[var(--ink-3)]" />
                      <p className="body font-semibold text-[var(--ink-1)]">Latest deploy</p>
                    </div>
                    {systemStatus.system.deploy === null && (
                      <p className="body-sm text-[var(--ink-3)]">
                        Add <code className="text-[var(--ink-2)]">VERCEL_API_TOKEN</code> env var to enable.
                      </p>
                    )}
                    {systemStatus.system.deploy && 'error' in systemStatus.system.deploy && (
                      <p className="body-sm text-[var(--error)]">{systemStatus.system.deploy.error}</p>
                    )}
                    {systemStatus.system.deploy && 'state' in systemStatus.system.deploy && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="body-sm rounded-full px-2.5 py-0.5 font-semibold"
                            style={{
                              background: systemStatus.system.deploy.state === 'READY' ? 'rgba(48,209,88,0.15)'
                                : systemStatus.system.deploy.state === 'ERROR' ? 'rgba(255,69,58,0.15)'
                                : systemStatus.system.deploy.state === 'BUILDING' ? 'rgba(255,214,10,0.15)'
                                : 'rgba(167,139,250,0.15)',
                              color: systemStatus.system.deploy.state === 'READY' ? 'var(--success)'
                                : systemStatus.system.deploy.state === 'ERROR' ? 'var(--error)'
                                : systemStatus.system.deploy.state === 'BUILDING' ? 'var(--warning)'
                                : 'var(--accent-violet)',
                            }}
                          >
                            {systemStatus.system.deploy.state}
                          </span>
                          {systemStatus.system.deploy.createdAt && (
                            <span className="body-sm text-[var(--ink-3)]">
                              {new Date(systemStatus.system.deploy.createdAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {systemStatus.system.deploy.meta?.githubCommitMessage && (
                          <p className="body-sm text-[var(--ink-2)]">
                            {systemStatus.system.deploy.meta.githubCommitMessage}
                          </p>
                        )}
                        {systemStatus.system.deploy.meta?.githubCommitSha && (
                          <p className="body-sm text-[var(--ink-4)] font-mono">
                            {systemStatus.system.deploy.meta.githubCommitSha.slice(0, 7)}
                            {systemStatus.system.deploy.meta.githubCommitAuthorName && ` · ${systemStatus.system.deploy.meta.githubCommitAuthorName}`}
                          </p>
                        )}
                      </div>
                    )}
                  </GlassCard>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <GlassCard className="overflow-hidden p-0">
          <div className="p-4" style={{ borderBottom: '1px solid var(--line-1)' }}>
            <p className="body-sm font-semibold text-[var(--ink-1)]">{users.length} users</p>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-[var(--ink-1)] truncate">{user.fullName ?? user.email}</p>
                  <p className="body-sm text-[var(--ink-3)] truncate">{user.email}</p>
                </div>
                <PlanBadge plan={user.plan} />
                <div className="flex gap-1">
                  {(['free', 'solo', 'master'] as const).filter(p => p !== user.plan).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlan(user.id, p)}
                      className="body-sm rounded px-2 py-0.5 transition-colors"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
                    >
                      → {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Coupons */}
      {tab === 'coupons' && (
        <div className="space-y-4">
          <GlassCard className="p-4">
            <p className="body-sm font-semibold text-[var(--ink-1)] mb-3">Create coupon</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Code</label>
                <Input
                  value={newCoupon.code}
                  onChange={e => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="LAUNCH50"
                  className="w-36 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Plan</label>
                <select
                  value={newCoupon.applicablePlan}
                  onChange={e => setNewCoupon(prev => ({ ...prev, applicablePlan: e.target.value }))}
                  className="h-9 rounded-md px-3 body-sm"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
                >
                  <option value="solo">Solo</option>
                  <option value="master">Master</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Discount %</label>
                <Input
                  type="number"
                  value={newCoupon.discountValue}
                  onChange={e => setNewCoupon(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Max uses</label>
                <Input
                  type="number"
                  value={newCoupon.maxUses}
                  onChange={e => setNewCoupon(prev => ({ ...prev, maxUses: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <PillButton size="sm" onClick={createCoupon} disabled={creating || !newCoupon.code.trim()}>
                Create
              </PillButton>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <div className="divide-y">
              {coupons.length === 0 && (
                <p className="p-4 body-sm text-[var(--ink-3)]">No coupons yet.</p>
              )}
              {coupons.map(coupon => (
                <div key={coupon.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="body-sm font-mono font-semibold text-[var(--ink-1)]">{coupon.code}</p>
                    <p className="body-sm text-[var(--ink-3)]">{coupon.applicablePlan} · {coupon.discountValue}% off · {coupon.usesSoFar}/{coupon.maxUses > 0 ? coupon.maxUses : '∞'} uses</p>
                  </div>
                  <button
                    onClick={() => deleteCoupon(coupon.id)}
                    className="body-sm text-[var(--ink-4)] hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Feedback */}
      {tab === 'feedback' && (
        <div className="space-y-4">
          {/* Filter row */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'praise', 'review', 'suggestion', 'complaint'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFeedbackFilter(f)}
                className="body-sm rounded-full px-3 py-1 font-semibold capitalize transition-colors"
                style={feedbackFilter === f
                  ? { background: 'var(--ink-1)', color: 'var(--bg-0)' }
                  : { background: 'var(--bg-2)', color: 'var(--ink-3)' }}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>

          {filteredFeedback.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="body-sm text-[var(--ink-3)]">No feedback yet.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {filteredFeedback.map((f) => {
                const meta = f.type && FEEDBACK_META[f.type] ? FEEDBACK_META[f.type] : null
                const Icon = meta?.icon ?? MessageSquare
                const color = meta?.color ?? 'var(--ink-3)'
                return (
                  <GlassCard key={f.id} className="p-4" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} style={{ color }} />
                        <span className="body-sm font-semibold text-[var(--ink-1)]">
                          {meta?.label ?? f.type ?? 'Feedback'}
                        </span>
                        {f.rating != null && (
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={11}
                                fill={i < (f.rating ?? 0) ? 'var(--warning)' : 'transparent'}
                                style={{ color: 'var(--warning)' }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="body-sm text-[var(--ink-4)]">
                        {new Date(f.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="body text-[var(--ink-1)] whitespace-pre-wrap">{f.message}</p>
                    <p className="body-sm mt-2 text-[var(--ink-3)]">
                      {f.userEmail ?? 'Anonymous'} · {f.page ?? f.source ?? '-'}
                    </p>
                  </GlassCard>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {tab === 'stats' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total users', value: stats.totalUsers },
            { label: 'Active this week', value: stats.activeThisWeek },
            { label: 'Episodes created', value: stats.totalEpisodes },
            { label: 'Published', value: stats.publishedEpisodes },
            { label: 'Onboarding complete', value: stats.onboardingComplete },
            { label: 'Never activated (>3d)', value: stats.neverActivated },
            { label: 'Guest briefs sent', value: stats.briefsSent },
            { label: 'Social content generated', value: stats.socialGenerated },
          ].map(stat => (
            <GlassCard key={stat.label} className="p-4">
              <p className="body-sm text-[var(--ink-3)]">{stat.label}</p>
              <p className="display-sm text-[var(--ink-1)] mt-1">{stat.value}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

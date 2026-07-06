'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { PlanBadge } from '@/components/common/PlanBadge'
import { Users, Tag, BarChart2, Settings, MessageSquare, Heart, Lightbulb, AlertTriangle, Star, Activity, CheckCircle2, XCircle, DollarSign, Link2, GitBranch, RefreshCw, Mail, TrendingUp, Plug } from 'lucide-react'
import { toast } from 'sonner'
import type { User, CouponCode, UserFeedback } from '@prisma/client'
import { useT } from '@/components/i18n/I18nProvider'

type UserWithActivity = User & {
  episodeCount: number
  publishedCount: number
  showCount: number
}

interface Props {
  users: UserWithActivity[]
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
  subscriptions: { paidMembers: number; soloActive: number; masterActive: number; mrrDollars: number; arrDollars: number; canceledLast30: number; stripeError: string | null }
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
  const t = useT()
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
      toast.success(t('admin.planUpdated'))
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
      toast.success(t('admin.couponCreated'))
    }
    setCreating(false)
  }

  async function deleteCoupon(id: string) {
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoupons(prev => prev.filter(c => c.id !== id))
      toast.success(t('admin.couponDeleted'))
    }
  }

  // Re-mint the coupon's Stripe promo in whatever Stripe mode THIS environment
  // runs in. Use on production if a code reads "invalid" at checkout because it
  // was originally created against a test key.
  const [resyncing, setResyncing] = useState<string | null>(null)
  async function resyncCoupon(id: string) {
    setResyncing(id)
    const res = await fetch(`/api/admin/coupons/${id}/resync`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setCoupons(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)))
      const mode = data.liveMode ? 'live' : 'test'
      toast.success(data.recreated ? `${t('admin.recreatedIn')} ${mode} ${t('admin.mode')}` : `${t('admin.alreadyInSync')} (${mode} ${t('admin.mode')})`)
    } else {
      toast.error(data.error ?? t('admin.resyncFailed'))
    }
    setResyncing(null)
  }

  const TABS = [
    { key: 'system' as Tab, label: t('admin.tabSystem'), icon: Activity },
    { key: 'users' as Tab, label: t('admin.tabUsers'), icon: Users },
    { key: 'coupons' as Tab, label: t('admin.tabCoupons'), icon: Tag },
    { key: 'feedback' as Tab, label: `${t('admin.tabFeedback')}${feedback.length ? ` (${feedback.length})` : ''}`, icon: MessageSquare },
    { key: 'stats' as Tab, label: t('admin.tabStats'), icon: BarChart2 },
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
        <h1 className="display-sm text-[var(--ink-1)]">{t('admin.title')}</h1>
      </div>

      {/* Tabs. Most are internal section toggles; "Marketing" navigates to the
          dedicated /admin/marketing-emails route (separate page with its own
          per-tier recipient counts), so it renders as a Link rather than a
          button. */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)', width: 'fit-content' }}>
        {TABS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
              style={tab === item.key
                ? { background: 'var(--bg-3)', color: 'var(--ink-1)' }
                : { color: 'var(--ink-3)' }}
            >
              <Icon size={14} /> {item.label}
            </button>
          )
        })}
        <Link
          href="/admin/marketing-emails"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
          style={{ color: 'var(--ink-3)' }}
        >
          <Mail size={14} /> {t('admin.tabMarketing')}
        </Link>
        <Link
          href="/admin/seo"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
          style={{ color: 'var(--ink-3)' }}
        >
          <TrendingUp size={14} /> {t('admin.tabSeo')}
        </Link>
        <Link
          href="/admin/integrations"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
          style={{ color: 'var(--ink-3)' }}
        >
          <Plug size={14} /> {t('admin.tabIntegrations')}
        </Link>
        <Link
          href="/admin/commissions"
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
          style={{ color: 'var(--ink-3)' }}
        >
          <DollarSign size={14} /> {t('admin.tabCommissions')}
        </Link>
      </div>

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-6">
          {/* Refresh indicator */}
          <div className="flex items-center justify-between">
            <p className="body-sm text-[var(--ink-3)]">
              {systemStatus
                ? `${t('admin.updatedAgoPrefix')}${secondsSinceFetch}${t('admin.updatedAgoSuffix')}`
                : t('admin.loading')}
            </p>
            <button
              onClick={async () => {
                const res = await fetch('/api/admin/system-status', { cache: 'no-store' })
                if (res.ok) { setSystemStatus(await res.json()); setSecondsSinceFetch(0) }
              }}
              className="body-sm rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              style={{ borderColor: 'var(--line-2)' }}
            >
              {t('admin.refreshNow')}
            </button>
          </div>

          {systemStatus && (
            <>
              {/* Subscriptions + revenue */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">{t('admin.subsRevenue')}</p>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
                  {[
                    { label: t('admin.paidMembers'), value: systemStatus.subscriptions.paidMembers },
                    { label: t('admin.soloActive'), value: systemStatus.subscriptions.soloActive },
                    { label: t('admin.masterActive'), value: systemStatus.subscriptions.masterActive },
                    { label: t('admin.mrr'), value: `$${systemStatus.subscriptions.mrrDollars.toLocaleString()}` },
                    { label: t('admin.arr'), value: `$${systemStatus.subscriptions.arrDollars.toLocaleString()}` },
                    { label: t('admin.cancels30'), value: systemStatus.subscriptions.canceledLast30 },
                  ].map((s) => (
                    <GlassCard key={s.label} className="p-4">
                      <p className="body-sm text-[var(--ink-3)]">{s.label}</p>
                      <p className="display-sm mt-1 text-[var(--ink-1)]">{s.value}</p>
                    </GlassCard>
                  ))}
                </div>
                {systemStatus.subscriptions.stripeError && (
                  <p className="body-sm mt-2 text-[var(--accent-rose,#fb7185)]">
                    {t('admin.stripePrefix')}{systemStatus.subscriptions.stripeError}
                  </p>
                )}
              </div>

              {/* Affiliate */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">{t('admin.affiliateLive')}</p>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: t('admin.activeInfluencers'), value: systemStatus.affiliate.activeInfluencers },
                    { label: t('admin.clicks24'), value: systemStatus.affiliate.clicksLast24h },
                    { label: t('admin.conversionsThisMonth'), value: systemStatus.affiliate.conversionsThisMonth },
                    { label: t('admin.unpaidCommission'), value: `$${systemStatus.affiliate.unpaidCommissionDollars.toLocaleString()}` },
                  ].map((s) => (
                    <GlassCard key={s.label} className="p-4">
                      <p className="body-sm text-[var(--ink-3)]">{s.label}</p>
                      <p className="display-sm mt-1 text-[var(--ink-1)]">{s.value}</p>
                    </GlassCard>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--ink-3)]">
                  <p className="body-sm">{t('admin.clicksAllTimePrefix')}<span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.clicksTotal.toLocaleString()}</span></p>
                  <p className="body-sm">{t('admin.attributionsPrefix')}<span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.attributionsTotal.toLocaleString()}</span></p>
                  {systemStatus.affiliate.topInfluencer && (
                    <p className="body-sm">{t('admin.topPrefix')}<span className="text-[var(--ink-1)] font-semibold">{systemStatus.affiliate.topInfluencer.name}</span> ({systemStatus.affiliate.topInfluencer.conversions}{t('admin.convSuffix')})</p>
                  )}
                </div>
              </div>

              {/* System health */}
              <div>
                <p className="eyebrow mb-3 text-[var(--ink-3)]">{t('admin.systemHealth')}</p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* DB + env */}
                  <GlassCard className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Link2 size={14} className="text-[var(--ink-3)]" />
                      <p className="body font-semibold text-[var(--ink-1)]">{t('admin.database')}</p>
                      {systemStatus.system.db.ok ? (
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                      ) : (
                        <XCircle size={14} style={{ color: 'var(--error)' }} />
                      )}
                    </div>
                    {systemStatus.system.db.error && (
                      <p className="body-sm text-[var(--error)] mb-3">{systemStatus.system.db.error}</p>
                    )}
                    <p className="eyebrow mb-2 text-[var(--ink-4)]">{t('admin.envVars')}</p>
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
                      <p className="body font-semibold text-[var(--ink-1)]">{t('admin.latestDeploy')}</p>
                    </div>
                    {systemStatus.system.deploy === null && (
                      <p className="body-sm text-[var(--ink-3)]">
                        {t('admin.addVercelTokenPrefix')}<code className="text-[var(--ink-2)]">VERCEL_API_TOKEN</code>{t('admin.addVercelTokenSuffix')}
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
            <p className="body-sm font-semibold text-[var(--ink-1)]">{users.length}{t('admin.usersSuffix')}</p>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-[var(--ink-1)] truncate">{user.fullName ?? user.email}</p>
                  <p className="body-sm text-[var(--ink-3)] truncate">{user.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                  <ActivityStat label={t('admin.episodes')} value={user.episodeCount} />
                  <ActivityStat label={t('admin.published')} value={user.publishedCount} />
                  <ActivityStat label={t('admin.shows')} value={user.showCount} />
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
            <p className="body-sm font-semibold text-[var(--ink-1)] mb-3">{t('admin.createCoupon')}</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('admin.code')}</label>
                <Input
                  value={newCoupon.code}
                  onChange={e => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="LAUNCH50"
                  className="w-36 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('admin.plan')}</label>
                <select
                  value={newCoupon.applicablePlan}
                  onChange={e => setNewCoupon(prev => ({ ...prev, applicablePlan: e.target.value }))}
                  className="h-9 rounded-md px-3 body-sm"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
                >
                  <option value="solo">{t('admin.solo')}</option>
                  <option value="master">{t('admin.master')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('admin.discountPct')}</label>
                <Input
                  type="number"
                  value={newCoupon.discountValue}
                  onChange={e => setNewCoupon(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('admin.maxUses')}</label>
                <Input
                  type="number"
                  value={newCoupon.maxUses}
                  onChange={e => setNewCoupon(prev => ({ ...prev, maxUses: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <PillButton size="sm" onClick={createCoupon} disabled={creating || !newCoupon.code.trim()}>
                {t('admin.create')}
              </PillButton>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            <div className="divide-y">
              {coupons.length === 0 && (
                <p className="p-4 body-sm text-[var(--ink-3)]">{t('admin.noCoupons')}</p>
              )}
              {coupons.map(coupon => (
                <div key={coupon.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="body-sm font-mono font-semibold text-[var(--ink-1)]">{coupon.code}</p>
                    <p className="body-sm text-[var(--ink-3)]">{coupon.applicablePlan} · {coupon.discountValue}{t('admin.pctOff')} · {coupon.usesSoFar}/{coupon.maxUses > 0 ? coupon.maxUses : '∞'} {t('admin.uses')}</p>
                  </div>
                  <button
                    onClick={() => resyncCoupon(coupon.id)}
                    disabled={resyncing === coupon.id}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors disabled:opacity-50"
                    title={t('admin.resyncTitle')}
                  >
                    <RefreshCw size={12} className={resyncing === coupon.id ? 'animate-spin' : ''} /> {t('admin.resync')}
                  </button>
                  <button
                    onClick={() => deleteCoupon(coupon.id)}
                    className="body-sm text-[var(--ink-4)] hover:text-red-400 transition-colors"
                  >
                    {t('admin.delete')}
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
                className="body-sm rounded-full px-3 py-1 font-semibold transition-colors"
                style={feedbackFilter === f
                  ? { background: 'var(--ink-1)', color: 'var(--bg-0)' }
                  : { background: 'var(--bg-2)', color: 'var(--ink-3)' }}
              >
                {f === 'all' ? t('admin.filterAll') : t(`admin.${f}`)}
              </button>
            ))}
          </div>

          {filteredFeedback.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="body-sm text-[var(--ink-3)]">{t('admin.noFeedback')}</p>
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
                          {meta ? t(`admin.${f.type as 'praise' | 'review' | 'suggestion' | 'complaint'}`) : (f.type ?? t('admin.feedback'))}
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
                      {f.userEmail ?? t('admin.anonymous')} · {f.page ?? f.source ?? '-'}
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
            { label: t('admin.totalUsers'), value: stats.totalUsers },
            { label: t('admin.activeThisWeek'), value: stats.activeThisWeek },
            { label: t('admin.episodesCreated'), value: stats.totalEpisodes },
            { label: t('admin.published'), value: stats.publishedEpisodes },
            { label: t('admin.onboardingComplete'), value: stats.onboardingComplete },
            { label: t('admin.neverActivated'), value: stats.neverActivated },
            { label: t('admin.briefsSent'), value: stats.briefsSent },
            { label: t('admin.socialGenerated'), value: stats.socialGenerated },
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

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="body-sm font-semibold text-[var(--ink-1)] leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--ink-4)] mt-0.5">{label}</p>
    </div>
  )
}

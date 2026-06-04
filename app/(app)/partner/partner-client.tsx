'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Influencer, InfluencerConversion, PayoutLog } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import {
  BarChart2, DollarSign, Link as LinkIcon, MousePointerClick, TrendingUp,
  Copy, CheckCircle2, AlertCircle, Settings, History, FileText,
} from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'

interface Stats {
  clicksLast30: number
  clicksTotal: number
  attributionsTotal: number
  conversionCount: number
  unpaidCommission: number
  paidCommission: number
  totalEarned: number
}

interface Props {
  influencer: Influencer
  conversions: InfluencerConversion[]
  payouts: PayoutLog[]
  stats: Stats
  referralUrl: string | null
}

type Tab = 'overview' | 'earnings' | 'payouts' | 'settings'

function formatDate(iso: string | Date | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success(`${label ?? t('partner.copied')}!`)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="body-sm flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
      style={{ borderColor: 'var(--line-2)' }}
    >
      {copied ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
      {copied ? t('partner.copied') : t('partner.copy')}
    </button>
  )
}

export function PartnerClient({ influencer, conversions, payouts, stats, referralUrl }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('overview')
  const [connecting, setConnecting] = useState(false)

  async function connectStripe() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.error ?? t('partner.couldNotOnboard'))
    } catch {
      toast.error(t('partner.networkError'))
    } finally {
      setConnecting(false)
    }
  }

  const TABS: { key: Tab; label: string; icon: typeof BarChart2 }[] = [
    { key: 'overview', label: t('partner.tabOverview'), icon: BarChart2 },
    { key: 'earnings', label: `${t('partner.tabEarnings')}${conversions.length ? ` (${conversions.length})` : ''}`, icon: DollarSign },
    { key: 'payouts', label: t('partner.tabPayouts'), icon: History },
    { key: 'settings', label: t('partner.tabSettings'), icon: Settings },
  ]

  const commissionLabel = influencer.commissionType === 'fixed'
    ? `$${influencer.commissionValue ?? 0}${t('partner.perSignup')}`
    : `${influencer.commissionValue ?? 0}%`

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <p className="eyebrow text-[var(--ink-3)]">{t('partner.portalEyebrow')}</p>
        <h1 className="display-sm mt-1 text-[var(--ink-1)]">
          {influencer.name.split(' ')[0]}{t('partner.dashboardSuffix')}
        </h1>
        <p className="body mt-1 text-[var(--ink-2)]">
          {t('partner.earningPrefix')}<span className="font-semibold text-[var(--ink-1)]">{commissionLabel}</span>{t('partner.earningSuffix')}
        </p>
      </div>

      {/* Pending agreement banner */}
      {!influencer.agreementSigned && (
        <GlassCard className="flex items-center gap-3 p-4" style={{ borderColor: 'rgba(255,214,10,0.4)' }}>
          <AlertCircle size={18} style={{ color: 'var(--warning)' }} />
          <div className="flex-1">
            <p className="body font-semibold text-[var(--ink-1)]">
              {t('partner.agreementNotSignedTitle')}
            </p>
            <p className="body-sm text-[var(--ink-3)]">
              {t('partner.agreementNotSignedBody')}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Pending Stripe banner */}
      {influencer.agreementSigned && !influencer.stripeOnboardingCompleted && (
        <GlassCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" style={{ borderColor: 'rgba(167,139,250,0.4)' }}>
          <AlertCircle size={18} style={{ color: 'var(--accent-violet)' }} className="shrink-0" />
          <div className="flex-1">
            <p className="body font-semibold text-[var(--ink-1)]">{t('partner.connectStripeTitle')}</p>
            <p className="body-sm text-[var(--ink-3)]">
              {t('partner.connectStripeBody')}
            </p>
          </div>
          <PillButton size="sm" onClick={connectStripe} disabled={connecting} className="shrink-0">
            {connecting ? t('partner.opening') : (influencer.stripeAccountId ? t('partner.finishStripe') : t('partner.connectStripe'))}
          </PillButton>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm font-semibold transition-colors"
              style={tab === t.key
                ? { background: 'var(--bg-3)', color: 'var(--ink-1)' }
                : { color: 'var(--ink-3)' }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: t('partner.statClicks30'), value: stats.clicksLast30, icon: MousePointerClick },
              { label: t('partner.statConversions'), value: stats.conversionCount, icon: TrendingUp },
              { label: t('partner.statUnpaid'), value: `$${stats.unpaidCommission.toLocaleString()}`, icon: DollarSign },
              { label: t('partner.statTotalEarned'), value: `$${stats.totalEarned.toLocaleString()}`, icon: BarChart2 },
            ].map(s => {
              const Icon = s.icon
              return (
                <GlassCard key={s.label} className="flex flex-col gap-2 p-5">
                  <Icon size={14} className="text-[var(--ink-3)]" />
                  <p className="display-sm font-bold text-[var(--ink-1)]" style={{ fontSize: 'clamp(24px,2.5vw,32px)' }}>
                    {s.value}
                  </p>
                  <p className="body-sm text-[var(--ink-3)]">{s.label}</p>
                </GlassCard>
              )
            })}
          </div>

          {/* Your link + code */}
          <GlassCard className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <LinkIcon size={16} className="text-[var(--accent-violet)]" />
              <p className="body font-semibold text-[var(--ink-1)]">{t('partner.linkAndCode')}</p>
            </div>
            {influencer.couponCode ? (
              <>
                <div className="rounded-[var(--radius-sm)] p-4" style={{ background: 'var(--bg-3)' }}>
                  <p className="body-sm mb-1 text-[var(--ink-3)]">{t('partner.couponCode')}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-2xl font-bold tracking-wider text-[var(--ink-1)]" style={{ fontFamily: 'ui-monospace, SF Mono, monospace' }}>
                      {influencer.couponCode}
                    </p>
                    <CopyButton value={influencer.couponCode} label={t('partner.codeCopied')} />
                  </div>
                </div>
                {referralUrl && (
                  <div className="rounded-[var(--radius-sm)] p-4" style={{ background: 'var(--bg-3)' }}>
                    <p className="body-sm mb-1 text-[var(--ink-3)]">{t('partner.referralLink')}</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="body truncate font-mono text-[var(--ink-1)]">{referralUrl}</p>
                      <CopyButton value={referralUrl} label={t('partner.linkCopied')} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="body-sm text-[var(--ink-3)]">
                {t('partner.noCouponAssigned')}
              </p>
            )}
          </GlassCard>

          {/* Recent earnings preview */}
          {conversions.length > 0 && (
            <GlassCard className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <p className="body font-semibold text-[var(--ink-1)]">{t('partner.recentConversions')}</p>
                <button
                  onClick={() => setTab('earnings')}
                  className="body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                >
                  {t('partner.seeAll')}
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
                {conversions.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="body-sm font-medium text-[var(--ink-1)] truncate">
                        {c.convertedUserEmail ?? t('partner.anonymous')}
                      </p>
                      <p className="body-sm text-[var(--ink-3)]">
                        {c.planPurchased} · {formatDate(c.conversionDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="body-sm font-semibold text-[var(--ink-1)]">
                        +${(c.commissionEarned ?? 0).toFixed(2)}
                      </span>
                      <span
                        className="body-sm rounded-full px-2.5 py-0.5 font-semibold"
                        style={{
                          background: c.commissionPaid ? 'rgba(48,209,88,0.15)' : 'rgba(167,139,250,0.15)',
                          color: c.commissionPaid ? 'var(--success)' : 'var(--accent-violet)',
                        }}
                      >
                        {c.commissionPaid ? t('partner.paid') : t('partner.pending')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* EARNINGS */}
      {tab === 'earnings' && (
        <GlassCard className="overflow-hidden p-0">
          {conversions.length === 0 ? (
            <p className="p-6 text-center body-sm text-[var(--ink-3)]">
              {t('partner.noConversions')}
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
              {conversions.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="body font-medium text-[var(--ink-1)] truncate">
                      {c.convertedUserEmail ?? t('partner.anonymous')}
                    </p>
                    <p className="body-sm text-[var(--ink-3)]">
                      {c.planPurchased}{t('partner.planSuffix')} · ${(c.revenueAmount ?? 0).toFixed(2)}{t('partner.revenueSuffix')} · {formatDate(c.conversionDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="body font-semibold text-[var(--ink-1)]">
                      +${(c.commissionEarned ?? 0).toFixed(2)}
                    </p>
                    <span
                      className="body-sm rounded-full px-2 py-0.5 font-semibold"
                      style={{
                        background: c.commissionPaid ? 'rgba(48,209,88,0.15)' : 'rgba(167,139,250,0.15)',
                        color: c.commissionPaid ? 'var(--success)' : 'var(--accent-violet)',
                      }}
                    >
                      {c.commissionPaid ? t('partner.paid') : t('partner.pending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* PAYOUTS */}
      {tab === 'payouts' && (
        <GlassCard className="overflow-hidden p-0">
          <div className="p-5" style={{ borderBottom: '1px solid var(--line-1)' }}>
            <p className="body font-semibold text-[var(--ink-1)]">{t('partner.payoutHistory')}</p>
            <p className="body-sm text-[var(--ink-3)]">
              {t('partner.totalPaidOutPrefix')}<span className="font-semibold text-[var(--ink-1)]">${stats.paidCommission.toLocaleString()}</span>
            </p>
          </div>
          {payouts.length === 0 ? (
            <p className="p-6 text-center body-sm text-[var(--ink-3)]">{t('partner.noPayouts')}</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
              {payouts.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="body font-semibold text-[var(--ink-1)]">
                      ${(p.amountUsd ?? 0).toFixed(2)}
                    </p>
                    <p className="body-sm text-[var(--ink-3)]">
                      {formatDate(p.payoutDate)} · {p.conversionsPaid ?? 0} {(p.conversionsPaid ?? 0) === 1 ? t('partner.conversionSingular') : t('partner.conversionPlural')}
                    </p>
                  </div>
                  <span
                    className="body-sm rounded-full px-2.5 py-0.5 font-semibold capitalize"
                    style={{
                      background: p.status === 'success' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
                      color: p.status === 'success' ? 'var(--success)' : 'var(--error)',
                    }}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div className="space-y-4">
          {/* Status card */}
          <GlassCard className="space-y-3 p-6">
            <p className="body font-semibold text-[var(--ink-1)]">{t('partner.status')}</p>
            <div className="space-y-2">
              {[
                { label: t('partner.agreementSigned'), done: influencer.agreementSigned, date: influencer.agreementSignedDate },
                { label: t('partner.stripeConnected'), done: influencer.stripeOnboardingCompleted, date: null },
                { label: t('partner.couponActive'), done: influencer.couponActive, date: null },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.done ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                    ) : (
                      <AlertCircle size={14} style={{ color: 'var(--ink-4)' }} />
                    )}
                    <p className="body-sm text-[var(--ink-1)]">{s.label}</p>
                  </div>
                  <p className="body-sm text-[var(--ink-3)]">
                    {s.done ? (s.date ? formatDate(s.date) : t('partner.yes')) : t('partner.notYet')}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Profile card */}
          <GlassCard className="space-y-3 p-6">
            <p className="body font-semibold text-[var(--ink-1)]">{t('partner.profile')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: t('partner.name'), value: influencer.name },
                { label: t('partner.email'), value: influencer.email ?? '-' },
                { label: t('partner.handle'), value: influencer.handle ?? '-' },
                { label: t('partner.platform'), value: influencer.platform ?? '-' },
                { label: t('partner.commission'), value: commissionLabel },
                { label: t('partner.couponCode'), value: influencer.couponCode ?? '-' },
              ].map(f => (
                <div key={f.label}>
                  <p className="body-sm text-[var(--ink-3)]">{f.label}</p>
                  <p className="body text-[var(--ink-1)]">{f.value}</p>
                </div>
              ))}
            </div>
            <p className="body-sm pt-2 text-[var(--ink-4)]">
              {t('partner.updateDetailsPrefix')}<a href="mailto:hello@bastudiopodcast.com" className="underline">hello@bastudiopodcast.com</a>.
            </p>
          </GlassCard>

          {/* Agreement link */}
          <GlassCard className="flex items-center gap-3 p-5">
            <FileText size={18} className="text-[var(--ink-3)]" />
            <div className="flex-1">
              <p className="body font-semibold text-[var(--ink-1)]">{t('partner.partnershipAgreement')}</p>
              <p className="body-sm text-[var(--ink-3)]">
                {influencer.agreementSigned
                  ? `${t('partner.signedOnPrefix')}${formatDate(influencer.agreementSignedDate)}`
                  : t('partner.notYetSigned')}
              </p>
            </div>
            {influencer.agreementSignatureToken && (
              <a
                href={`/influencer-agreement?token=${influencer.agreementSignatureToken}`}
                className="body-sm rounded-full border px-4 py-1.5 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                {t('partner.view')}
              </a>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}

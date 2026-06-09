'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { trackStartSubscription } from '@/lib/gtm'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { CreditCard, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Plan, PlanStatus, BillingPeriod } from '@prisma/client'
import { useT } from '@/components/i18n/I18nProvider'

interface BillingUser {
  plan: Plan
  planStatus: PlanStatus
  billingPeriod: BillingPeriod | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function BillingClient({ user }: { user: BillingUser | null }) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const subscriptionTracked = useRef(false)

  // Stripe redirects back here as /account/billing?success=1&session_id=... after
  // a completed checkout. Fire the `start_subscription` conversion exactly once,
  // pulling the confirmed amount/plan from Stripe via the server (never trusting
  // the client). Dedupe per session_id across reloads so a refreshed success page
  // can't double-count, then strip the params from the URL.
  useEffect(() => {
    if (subscriptionTracked.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') !== '1') return
    const sessionId = params.get('session_id')
    if (!sessionId) return

    const dedupeKey = `ba_sub_tracked_${sessionId}`
    try {
      if (sessionStorage.getItem(dedupeKey)) return
    } catch {
      /* sessionStorage unavailable; the in-memory ref still guards this load */
    }
    subscriptionTracked.current = true

    ;(async () => {
      try {
        const res = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
        const data = await res.json()
        if (res.ok && data.paid) {
          await trackStartSubscription({
            value: data.value,
            currency: data.currency,
            plan: data.plan,
            billingPeriod: data.billingPeriod,
            transactionId: data.transactionId,
            userId: data.userId,
            email: data.email,
          })
          try {
            sessionStorage.setItem(dedupeKey, '1')
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* analytics is best-effort; never disrupt the billing page */
      } finally {
        // Deep-link return: if checkout carried a `next` path (e.g. the episode
        // the user was upgrading to unlock), send them straight back there.
        // Validated to a same-site relative path to avoid open-redirects.
        const next = params.get('next')
        if (next && /^\/(?!\/)/.test(next)) {
          window.location.href = next
          return
        }
        // Otherwise clean the conversion params out of the URL so a manual
        // refresh or a shared link won't re-enter this flow.
        const url = new URL(window.location.href)
        url.searchParams.delete('success')
        url.searchParams.delete('session_id')
        window.history.replaceState({}, '', url.toString())
        router.refresh()
      }
    })()
  }, [router])

  const PLAN_LABEL: Record<Plan, string> = { free: t('billing.planFree'), solo: t('billing.planSolo'), master: t('billing.planMaster') }

  async function call(action: 'cancel' | 'resume' | 'portal-card') {
    setBusy(action)
    try {
      const res = await fetch(`/api/stripe/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? `${t('billing.couldNotPrefix')}${action}`); return }
      if (action === 'portal-card' && data.url) {
        window.location.href = data.url
        return
      }
      if (action === 'cancel') toast.success(t('billing.cancellationScheduled'))
      if (action === 'resume') toast.success(t('billing.subscriptionResumed'))
      router.refresh()
    } catch {
      toast.error(t('billing.networkError'))
    } finally {
      setBusy(null)
    }
  }

  if (!user) return null

  const isPaid = user.plan !== 'free' && user.stripeSubscriptionId
  const isCanceling = user.cancelAtPeriodEnd
  const periodLabel = user.billingPeriod === 'annual' ? t('billing.annual') : t('billing.monthly')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="display-sm text-[var(--ink-1)]">{t('billing.title')}</h1>
        <p className="body mt-1 text-[var(--ink-2)]">{t('billing.subtitle')}</p>
      </div>

      {/* Cancel-pending banner */}
      {isCanceling && user.currentPeriodEnd && (
        <GlassCard className="flex items-center gap-3 p-4" style={{ borderColor: 'rgba(255,214,10,0.4)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
          <div className="flex-1">
            <p className="body font-semibold text-[var(--ink-1)]">{t('billing.planEndsOnPrefix')}{formatDate(user.currentPeriodEnd)}</p>
            <p className="body-sm text-[var(--ink-3)]">{t('billing.keepUsingPrefix')}{PLAN_LABEL[user.plan]}{t('billing.keepUsingSuffix')}</p>
          </div>
          <button
            onClick={() => call('resume')}
            disabled={busy === 'resume'}
            className="body-sm rounded-full bg-[var(--ink-1)] px-4 py-1.5 font-semibold text-[var(--bg-0)] disabled:opacity-50"
          >
            {busy === 'resume' ? t('billing.resuming') : t('billing.keepMyPlan')}
          </button>
        </GlassCard>
      )}

      {/* Current plan card */}
      <GlassCard className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-[var(--ink-3)]">{t('billing.currentPlan')}</p>
            <p className="display-sm mt-1 text-[var(--ink-1)]">{PLAN_LABEL[user.plan]}</p>
            {isPaid && (
              <p className="body-sm mt-1 text-[var(--ink-3)]">
                {periodLabel} ·
                {user.planStatus === 'active' && ` ${t('billing.active')}`}
                {user.planStatus === 'past_due' && ` ${t('billing.pastDue')}`}
                {user.planStatus === 'trialing' && ` ${t('billing.trial')}`}
                {user.planStatus === 'cancelled' && ` ${t('billing.cancelled')}`}
              </p>
            )}
          </div>
          <Link
            href="/pricing"
            className="body-sm flex items-center gap-1 rounded-full border px-4 py-2 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            {isPaid ? t('billing.changePlan') : t('billing.upgrade')} <ArrowRight size={13} />
          </Link>
        </div>

        {isPaid && user.currentPeriodEnd && !isCanceling && (
          <div className="flex items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--line-1)' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
            <p className="body-sm text-[var(--ink-2)]">
              {t('billing.renewsOnPrefix')}<span className="font-semibold text-[var(--ink-1)]">{formatDate(user.currentPeriodEnd)}</span>
            </p>
          </div>
        )}
      </GlassCard>

      {/* Payment method (links to Stripe portal) */}
      {isPaid && (
        <GlassCard className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-[var(--ink-3)]" />
            <div>
              <p className="body font-semibold text-[var(--ink-1)]">{t('billing.paymentMethod')}</p>
              <p className="body-sm text-[var(--ink-3)]">{t('billing.paymentMethodHint')}</p>
            </div>
          </div>
          <PillButton
            variant="secondary"
            size="sm"
            onClick={() => call('portal-card')}
            disabled={busy === 'portal-card'}
          >
            {busy === 'portal-card' ? t('billing.opening') : t('billing.manage')}
          </PillButton>
        </GlassCard>
      )}

      {/* Cancel */}
      {isPaid && !isCanceling && (
        <GlassCard className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">{t('billing.cancelSubscription')}</p>
            <p className="body-sm text-[var(--ink-3)]">
              {t('billing.keepAccessUntilPrefix')}{formatDate(user.currentPeriodEnd)}{t('billing.keepAccessUntilSuffix')}
            </p>
          </div>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: t('billing.cancelConfirmTitle'),
                message: t('billing.cancelConfirmMsg'),
                confirmLabel: t('billing.cancelSubscription'),
                cancelLabel: t('billing.keepPlan'),
                destructive: true,
              })
              if (ok) call('cancel')
            }}
            disabled={busy === 'cancel'}
            className="body-sm rounded-full border px-4 py-2 font-semibold text-[var(--error)] hover:bg-[rgba(255,69,58,0.08)] disabled:opacity-50"
            style={{ borderColor: 'rgba(255,69,58,0.4)' }}
          >
            {busy === 'cancel' ? t('billing.canceling') : t('billing.cancel')}
          </button>
        </GlassCard>
      )}

      {/* Free user fallback */}
      {!isPaid && (
        <GlassCard className="space-y-3 p-6">
          <p className="body font-semibold text-[var(--ink-1)]">{t('billing.onFreePlan')}</p>
          <p className="body-sm text-[var(--ink-2)]">{t('billing.freePlanHint')}</p>
          <Link href="/pricing" className="pill-primary pill-primary-sm w-fit">
            {t('billing.seePlans')} <ArrowRight size={13} />
          </Link>
        </GlassCard>
      )}
    </div>
  )
}

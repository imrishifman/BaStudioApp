'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CreditCard, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Plan, PlanStatus, BillingPeriod } from '@prisma/client'

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

const PLAN_LABEL: Record<Plan, string> = { free: 'Free', solo: 'Studio Solo', master: 'Master' }

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function BillingClient({ user }: { user: BillingUser | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function call(action: 'cancel' | 'resume' | 'portal-card') {
    setBusy(action)
    try {
      const res = await fetch(`/api/stripe/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? `Could not ${action}`); return }
      if (action === 'portal-card' && data.url) {
        window.location.href = data.url
        return
      }
      if (action === 'cancel') toast.success('Cancellation scheduled')
      if (action === 'resume') toast.success('Subscription resumed')
      router.refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(null)
    }
  }

  if (!user) return null

  const isPaid = user.plan !== 'free' && user.stripeSubscriptionId
  const isCanceling = user.cancelAtPeriodEnd
  const periodLabel = user.billingPeriod === 'annual' ? 'Annual' : 'Monthly'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="display-sm text-[var(--ink-1)]">Billing</h1>
        <p className="body mt-1 text-[var(--ink-2)]">Manage your subscription and payment method.</p>
      </div>

      {/* Cancel-pending banner */}
      {isCanceling && user.currentPeriodEnd && (
        <GlassCard className="flex items-center gap-3 p-4" style={{ borderColor: 'rgba(255,214,10,0.4)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
          <div className="flex-1">
            <p className="body font-semibold text-[var(--ink-1)]">Your plan ends on {formatDate(user.currentPeriodEnd)}</p>
            <p className="body-sm text-[var(--ink-3)]">You can keep using {PLAN_LABEL[user.plan]} features until then.</p>
          </div>
          <button
            onClick={() => call('resume')}
            disabled={busy === 'resume'}
            className="body-sm rounded-full bg-[var(--ink-1)] px-4 py-1.5 font-semibold text-[var(--bg-0)] disabled:opacity-50"
          >
            {busy === 'resume' ? 'Resuming…' : 'Keep my plan'}
          </button>
        </GlassCard>
      )}

      {/* Current plan card */}
      <GlassCard className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-[var(--ink-3)]">Current plan</p>
            <p className="display-sm mt-1 text-[var(--ink-1)]">{PLAN_LABEL[user.plan]}</p>
            {isPaid && (
              <p className="body-sm mt-1 text-[var(--ink-3)]">
                {periodLabel} ·
                {user.planStatus === 'active' && ' Active'}
                {user.planStatus === 'past_due' && ' Past due'}
                {user.planStatus === 'trialing' && ' Trial'}
                {user.planStatus === 'cancelled' && ' Cancelled'}
              </p>
            )}
          </div>
          <Link
            href="/pricing"
            className="body-sm flex items-center gap-1 rounded-full border px-4 py-2 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            {isPaid ? 'Change plan' : 'Upgrade'} <ArrowRight size={13} />
          </Link>
        </div>

        {isPaid && user.currentPeriodEnd && !isCanceling && (
          <div className="flex items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--line-1)' }}>
            <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
            <p className="body-sm text-[var(--ink-2)]">
              Renews on <span className="font-semibold text-[var(--ink-1)]">{formatDate(user.currentPeriodEnd)}</span>
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
              <p className="body font-semibold text-[var(--ink-1)]">Payment method</p>
              <p className="body-sm text-[var(--ink-3)]">Update your card on Stripe&apos;s secure portal.</p>
            </div>
          </div>
          <PillButton
            variant="secondary"
            size="sm"
            onClick={() => call('portal-card')}
            disabled={busy === 'portal-card'}
          >
            {busy === 'portal-card' ? 'Opening…' : 'Manage'}
          </PillButton>
        </GlassCard>
      )}

      {/* Cancel */}
      {isPaid && !isCanceling && (
        <GlassCard className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">Cancel subscription</p>
            <p className="body-sm text-[var(--ink-3)]">
              You&apos;ll keep access until {formatDate(user.currentPeriodEnd)}.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Cancel your subscription at the end of the current period?')) call('cancel')
            }}
            disabled={busy === 'cancel'}
            className="body-sm rounded-full border px-4 py-2 font-semibold text-[var(--error)] hover:bg-[rgba(255,69,58,0.08)] disabled:opacity-50"
            style={{ borderColor: 'rgba(255,69,58,0.4)' }}
          >
            {busy === 'cancel' ? 'Canceling…' : 'Cancel'}
          </button>
        </GlassCard>
      )}

      {/* Free user fallback */}
      {!isPaid && (
        <GlassCard className="space-y-3 p-6">
          <p className="body font-semibold text-[var(--ink-1)]">You&apos;re on the Free plan</p>
          <p className="body-sm text-[var(--ink-2)]">Upgrade to unlock more episodes, shows, and team features.</p>
          <Link href="/pricing" className="pill-primary pill-primary-sm w-fit">
            See plans <ArrowRight size={13} />
          </Link>
        </GlassCard>
      )}
    </div>
  )
}

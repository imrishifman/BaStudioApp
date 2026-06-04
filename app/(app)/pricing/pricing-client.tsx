'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { EyebrowTag } from '@/components/common/EyebrowTag'
import { cn } from '@/lib/utils'
import type { Plan } from '@prisma/client'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'

const PLANS = [
  {
    key: 'free' as Plan,
    nameKey: 'pricing.freeName',
    monthly: 0,
    annual: 0,
    descKey: 'pricing.freeDesc',
    featureKeys: ['pricing.freeF1', 'pricing.freeF2', 'pricing.freeF3', 'pricing.freeF4', 'pricing.freeF5'],
    recommended: false,
  },
  {
    key: 'solo' as Plan,
    nameKey: 'pricing.soloName',
    monthly: 19.99,
    annual: 15.99,
    descKey: 'pricing.soloDesc',
    featureKeys: ['pricing.soloF1', 'pricing.soloF2', 'pricing.soloF3', 'pricing.soloF4', 'pricing.soloF5', 'pricing.soloF6'],
    recommended: true,
  },
  {
    key: 'master' as Plan,
    nameKey: 'pricing.masterName',
    monthly: 29.99,
    annual: 23.99,
    descKey: 'pricing.masterDesc',
    featureKeys: ['pricing.masterF1', 'pricing.masterF2', 'pricing.masterF3', 'pricing.masterF4', 'pricing.masterF5', 'pricing.masterF6'],
    recommended: false,
  },
]

interface Props { currentPlan: Plan }

export function AppPricingClient({ currentPlan }: Props) {
  const t = useT()
  const [annual, setAnnual] = useState(false)
  const [pending, setPending] = useState<Plan | null>(null)

  async function handleUpgrade(planKey: Plan) {
    if (planKey === currentPlan) return
    if (planKey === 'free') {
      toast(t('pricing.downgradeToast'))
      return
    }
    setPending(planKey)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, period: annual ? 'annual' : 'monthly' }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error ?? t('pricing.couldNotCheckout'))
        return
      }
      window.location.href = data.url
    } catch {
      toast.error(t('pricing.couldNotCheckout'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="display-sm text-[var(--ink-1)]">{t('pricing.title')}</h1>
        <div className="mx-auto flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
          {[t('pricing.monthly'), t('pricing.annually')].map((label, i) => (
            <button
              key={label}
              onClick={() => setAnnual(i === 1)}
              className={cn('body-sm rounded-full px-4 py-1.5 font-semibold transition-all', (i === 1) === annual ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan
          return (
            <GlassCard
              key={plan.key}
              className="flex flex-col p-8"
              style={plan.recommended ? { borderColor: 'rgba(167,139,250,0.4)' } : {}}
            >
              {plan.recommended && <EyebrowTag className="mb-4">{t('pricing.mostPopular')}</EyebrowTag>}
              <p className="display-sm mb-1 text-[var(--ink-1)]">{t(plan.nameKey)}</p>
              <p className="body-sm mb-6 text-[var(--ink-3)]">{t(plan.descKey)}</p>
              <div className="mb-8">
                <span className="font-bold text-[var(--ink-1)]" style={{ fontSize: 44, letterSpacing: '-0.03em' }}>
                  ${plan.monthly === 0 ? '0' : annual ? plan.annual : plan.monthly}
                </span>
                <span className="body-sm ml-1 text-[var(--ink-3)]">{plan.monthly === 0 ? t('pricing.forever') : t('pricing.perMonth')}</span>
              </div>
              <ul className="mb-8 flex flex-col gap-3">
                {plan.featureKeys.map(fk => (
                  <li key={fk} className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                    <span className="body-sm text-[var(--ink-2)]">{t(fk)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {isCurrent ? (
                  <div className="body-sm rounded-full border px-4 py-2.5 text-center font-semibold text-[var(--ink-3)]" style={{ borderColor: 'var(--line-1)' }}>
                    {t('pricing.currentPlan')}
                  </div>
                ) : (
                  <PillButton
                    className="w-full"
                    variant={plan.recommended ? 'primary' : 'secondary'}
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={plan.key === 'free' || pending !== null}
                  >
                    {pending === plan.key ? t('pricing.loading') : plan.key === 'free' ? t('pricing.downgrade') : `${t('pricing.upgradeToPrefix')}${t(plan.nameKey)}`}
                  </PillButton>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

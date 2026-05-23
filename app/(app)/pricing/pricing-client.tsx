'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { EyebrowTag } from '@/components/common/EyebrowTag'
import { cn } from '@/lib/utils'
import type { Plan } from '@prisma/client'
import { toast } from 'sonner'

const PLANS = [
  {
    key: 'free' as Plan,
    name: 'Free',
    monthly: 0,
    annual: 0,
    description: 'Try the studio.',
    features: ['1 episode total', '1 show', 'AI research (1 use)', 'Basic question generation', 'Data export'],
    recommended: false,
  },
  {
    key: 'solo' as Plan,
    name: 'Studio Solo',
    monthly: 19.99,
    annual: 15.99,
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SOLO_MONTHLY,
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SOLO_ANNUAL,
    description: 'For solo podcasters.',
    features: ['4 episodes / month', '2 shows', 'Full Podcast DNA', 'Calendar sync', 'Shareable guest brief', 'Priority support'],
    recommended: true,
  },
  {
    key: 'master' as Plan,
    name: 'Master',
    monthly: 29.99,
    annual: 23.99,
    description: 'For teams and networks.',
    features: ['Unlimited episodes & shows', 'Team seats', 'Approval workflow', 'Team chat', 'Shared calendar', 'Admin analytics'],
    recommended: false,
  },
]

interface Props { currentPlan: Plan }

export function AppPricingClient({ currentPlan }: Props) {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState<Plan | null>(null)

  async function handleUpgrade(planKey: Plan) {
    if (planKey === currentPlan) return
    setLoading(planKey)
    try {
      const priceKey = planKey === 'solo'
        ? (annual ? 'solo_annual' : 'solo_monthly')
        : (annual ? 'master_annual' : 'master_monthly')
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error('Could not start checkout')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="display-sm text-[var(--ink-1)]">Upgrade your plan</h1>
        <div className="mx-auto flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
          {['Monthly', 'Annually −20%'].map((label, i) => (
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
              {plan.recommended && <EyebrowTag className="mb-4">Most popular</EyebrowTag>}
              <p className="display-sm mb-1 text-[var(--ink-1)]">{plan.name}</p>
              <p className="body-sm mb-6 text-[var(--ink-3)]">{plan.description}</p>
              <div className="mb-8">
                <span className="font-bold text-[var(--ink-1)]" style={{ fontSize: 44, letterSpacing: '-0.03em' }}>
                  ${plan.monthly === 0 ? '0' : annual ? plan.annual : plan.monthly}
                </span>
                <span className="body-sm ml-1 text-[var(--ink-3)]">{plan.monthly === 0 ? 'forever' : '/mo'}</span>
              </div>
              <ul className="mb-8 flex flex-col gap-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                    <span className="body-sm text-[var(--ink-2)]">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {isCurrent ? (
                  <div className="body-sm rounded-full border px-4 py-2.5 text-center font-semibold text-[var(--ink-3)]" style={{ borderColor: 'var(--line-1)' }}>
                    Current plan
                  </div>
                ) : (
                  <PillButton
                    className="w-full"
                    variant={plan.recommended ? 'primary' : 'secondary'}
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={loading === plan.key || plan.key === 'free'}
                  >
                    {loading === plan.key ? 'Loading…' : plan.key === 'free' ? 'Downgrade' : `Upgrade to ${plan.name}`}
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

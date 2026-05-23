'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { EyebrowTag } from '@/components/common/EyebrowTag'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Free',
    monthly: 0,
    annual: 0,
    description: 'Try the studio.',
    features: [
      '1 episode total',
      '1 show',
      'AI research (1 use)',
      'Basic question generation',
      'Data export',
    ],
    cta: 'Get started free',
    ctaHref: '/?signin=1',
    recommended: false,
  },
  {
    name: 'Studio Solo',
    monthly: 19.99,
    annual: 15.99,
    description: 'For solo podcasters.',
    features: [
      '4 episodes / month',
      '2 shows',
      'Full Podcast DNA',
      'Calendar sync',
      'Shareable guest brief',
      'Priority support',
    ],
    cta: 'Start Studio Solo',
    ctaHref: '/?signin=1',
    recommended: true,
  },
  {
    name: 'Master',
    monthly: 29.99,
    annual: 23.99,
    description: 'For teams and networks.',
    features: [
      'Unlimited episodes & shows',
      'Team seats',
      'Approval workflow',
      'Team chat',
      'Shared calendar',
      'Admin analytics',
    ],
    cta: 'Start Master',
    ctaHref: '/?signin=1',
    recommended: false,
  },
]

export function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section
      id="pricing"
      className="mx-auto max-w-[1240px]"
      style={{ padding: '0 clamp(20px, 5vw, 80px) clamp(96px, 12vw, 200px)' }}
    >
      <div className="mb-16 flex flex-col items-center gap-6 text-center">
        <EyebrowTag dot>Pricing</EyebrowTag>
        <h2 className="display-lg text-[var(--ink-1)]">
          One studio, three scales.
        </h2>

        {/* Billing toggle */}
        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
        >
          {['Monthly', 'Annually −20%'].map((label, i) => (
            <button
              key={label}
              onClick={() => setAnnual(i === 1)}
              className={cn(
                'body-sm rounded-full px-4 py-1.5 font-semibold transition-all duration-200',
                (i === 1) === annual
                  ? 'bg-[var(--ink-1)] text-[var(--bg-0)]'
                  : 'text-[var(--ink-3)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard
              className="relative flex h-full flex-col p-8"
              style={
                plan.recommended
                  ? { borderColor: 'transparent', padding: '1px' }
                  : {}
              }
            >
              {plan.recommended && (
                <div
                  className="absolute inset-0 rounded-[var(--radius-lg)]"
                  style={{
                    background: 'var(--vision-gradient)',
                    padding: '1px',
                    zIndex: -1,
                  }}
                />
              )}
              <div
                className={cn(
                  'flex h-full flex-col',
                  plan.recommended && 'rounded-[calc(var(--radius-lg)-1px)] bg-[var(--bg-1)] p-8'
                )}
              >
                {plan.recommended && (
                  <EyebrowTag className="mb-4">Most popular</EyebrowTag>
                )}
                <p className="display-sm mb-2 text-[var(--ink-1)]">{plan.name}</p>
                <p className="body-sm mb-6 text-[var(--ink-3)]">{plan.description}</p>

                <div className="mb-8">
                  <span
                    className="font-bold text-[var(--ink-1)]"
                    style={{ fontSize: 'clamp(36px, 4vw, 52px)', letterSpacing: '-0.03em' }}
                  >
                    $
                    {plan.monthly === 0
                      ? '0'
                      : annual
                        ? plan.annual
                        : plan.monthly}
                  </span>
                  {plan.monthly > 0 && (
                    <span className="body-sm ml-1 text-[var(--ink-3)]">/mo</span>
                  )}
                  {plan.monthly === 0 && (
                    <span className="body-sm ml-1 text-[var(--ink-3)]">forever</span>
                  )}
                </div>

                <ul className="mb-8 flex flex-col gap-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--success)' }}
                      />
                      <span className="body-sm text-[var(--ink-2)]">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link
                    href={plan.ctaHref}
                    className={cn(
                      'block w-full text-center',
                      plan.recommended ? 'pill-primary' : 'pill-secondary'
                    )}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

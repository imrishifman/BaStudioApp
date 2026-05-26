'use client'

import Link from 'next/link'
import { Check, Circle, X } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'

export interface QuestStep {
  label: string
  done: boolean
  href: string
  cta: string
}

export function OnboardingQuest({
  steps,
  onDismiss,
}: {
  steps: QuestStep[]
  onDismiss: () => void
}) {
  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-[var(--ink-1)]" style={{ fontSize: 18 }}>
            Get started {doneCount === steps.length ? '🎉' : '🚀'}
          </p>
          <p className="body-sm text-[var(--ink-3)]">
            {doneCount} of {steps.length} complete - finish setting up your studio.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
          aria-label="Dismiss for now"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))',
          }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2.5"
            style={{ background: 'var(--bg-2)' }}
          >
            <div className="flex items-center gap-3">
              {s.done ? (
                <Check size={16} style={{ color: 'var(--success)' }} />
              ) : (
                <Circle size={16} className="text-[var(--ink-4)]" />
              )}
              <span
                className={
                  s.done
                    ? 'body-sm text-[var(--ink-3)] line-through'
                    : 'body-sm text-[var(--ink-1)]'
                }
              >
                {s.label}
              </span>
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className="body-sm font-semibold text-[var(--accent-violet)] hover:underline"
              >
                {s.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onDismiss}
        className="body-sm mt-4 text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
      >
        Maybe later
      </button>
    </GlassCard>
  )
}

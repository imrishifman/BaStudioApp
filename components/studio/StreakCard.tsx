'use client'

import { Flame } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import type { StreakInfo } from '@/lib/streak'

export function StreakCard({ streak, atRisk, publishedThisWeek, recent }: StreakInfo) {
  const flameColor = atRisk ? 'var(--warning)' : '#ff9f0a'
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${flameColor}1f` }}
          >
            <Flame size={20} style={{ color: flameColor }} />
          </div>
          <div>
            <p className="font-semibold text-[var(--ink-1)]" style={{ fontSize: 18 }}>
              {streak > 0 ? `${streak}-week streak 🔥` : 'Weekly challenge'}
            </p>
            <p
              className="body-sm"
              style={{ color: atRisk ? 'var(--warning)' : 'var(--ink-3)' }}
            >
              {publishedThisWeek
                ? "You've published this week - streak safe 🎉"
                : atRisk
                  ? 'Publish an episode this week to keep it alive.'
                  : 'Publish an episode this week to start a new streak.'}
            </p>
          </div>
        </div>

        {/* Last 6 weeks */}
        <div className="hidden items-center gap-1.5 sm:flex">
          {recent.map((on, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: on ? '#ff9f0a' : 'var(--bg-3)' }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

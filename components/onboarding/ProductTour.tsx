'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles,
  LayoutDashboard,
  Tv2,
  Dna,
  Users,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to Ba Studio',
    body: "Here's a 60-second tour of how you'll produce a podcast episode, end to end.",
  },
  {
    icon: LayoutDashboard,
    title: 'Your Studio',
    body: 'Your home base — episodes in progress, your publishing streak, and anything that needs attention live here.',
  },
  {
    icon: Tv2,
    title: 'Shows',
    body: 'Each show holds its episodes, team, and guests. Open a show to manage everything in one place.',
  },
  {
    icon: Dna,
    title: 'Podcast DNA',
    body: "Define your show's structure, tone, and voice once — the AI uses it so every episode sounds like you.",
  },
  {
    icon: Users,
    title: 'Guests CRM',
    body: 'Every guest flows in automatically. Drag them across the pipeline (Cold → Warm → Recorded → Published) as the relationship grows.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    body: 'Schedule releases by dragging episodes onto dates, and mark when you and your team are available.',
  },
]

export function ProductTour() {
  const [seen, setSeen] = useState(true)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      setSeen(localStorage.getItem('ba-tour-seen') === '1')
    } catch {
      setSeen(false)
    }
  }, [])

  function finish() {
    try {
      localStorage.setItem('ba-tour-seen', '1')
    } catch {
      /* ignore */
    }
    setSeen(true)
  }

  if (seen) return null

  const Icon = STEPS[step].icon
  const last = step === STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <GlassCard className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 20 : 6,
                  background: i <= step ? 'var(--accent-violet)' : 'var(--bg-3)',
                }}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--bg-3)' }}
        >
          <Icon size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>

        <h2 className="display-sm mb-2 text-[var(--ink-1)]">{STEPS[step].title}</h2>
        <p className="body text-[var(--ink-2)]">{STEPS[step].body}</p>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={finish}
            className="body-sm text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <PillButton variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft size={14} /> Back
              </PillButton>
            )}
            <PillButton size="sm" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
              {last ? (
                'Start creating'
              ) : (
                <>
                  Next <ChevronRight size={14} />
                </>
              )}
            </PillButton>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

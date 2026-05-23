'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { ArrowRight, Check } from 'lucide-react'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

const STYLE_OPTIONS = [
  { value: 'conversational', label: 'Conversational', desc: 'Natural, warm dialogue' },
  { value: 'deep_dive', label: 'Deep Dive', desc: 'Long-form, thorough exploration' },
  { value: 'fast_paced', label: 'Fast-Paced', desc: 'Punchy, quick exchanges' },
  { value: 'philosophical', label: 'Philosophical', desc: 'Big ideas, first principles' },
  { value: 'challenging', label: 'Challenging', desc: 'Push back, test ideas' },
  { value: 'supportive', label: 'Supportive', desc: 'Empathetic, encouraging' },
]

export function Step4Style({ episode, show, onNext }: Props) {
  const defaultInfluences = episode?.interviewInfluences?.length
    ? episode.interviewInfluences
    : (show?.interviewInfluences ?? [])

  const [selected, setSelected] = useState<string[]>(defaultInfluences)

  function toggle(val: string) {
    setSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  async function handleNext() {
    await onNext({ interviewInfluences: selected, status: 'questions' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 4 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Interview style</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Select the styles that fit this episode. These guide the questions and script.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STYLE_OPTIONS.map(opt => {
          const active = selected.includes(opt.value)
          return (
            <GlassCard
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 p-4 transition-all"
              onClick={() => toggle(opt.value)}
              style={active ? { borderColor: 'var(--accent-violet)' } : {}}
            >
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: active ? 'var(--accent-violet)' : 'var(--bg-3)', border: `1px solid ${active ? 'var(--accent-violet)' : 'var(--line-2)'}` }}
              >
                {active && <Check size={11} color="white" />}
              </div>
              <div>
                <p className="body font-semibold text-[var(--ink-1)]">{opt.label}</p>
                <p className="body-sm text-[var(--ink-3)]">{opt.desc}</p>
              </div>
            </GlassCard>
          )
        })}
      </div>

      <PillButton onClick={handleNext}>
        Next <ArrowRight size={14} />
      </PillButton>
    </div>
  )
}

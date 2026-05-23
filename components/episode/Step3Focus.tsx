'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import { ArrowRight } from 'lucide-react'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

const FOCUS_QUESTIONS = [
  'What 3 things do you want this episode to cover?',
  'What outcome do you want for the listener?',
  'What makes this guest uniquely right for your show?',
]

export function Step3Focus({ episode, onNext }: Props) {
  const initialAnswers = (episode?.focusAnswers as string[] | null) ?? ['', '', '']
  const [answers, setAnswers] = useState<string[]>(initialAnswers)

  function setAnswer(i: number, v: string) {
    setAnswers(prev => prev.map((a, idx) => idx === i ? v : a))
  }

  async function handleNext() {
    await onNext({ focusAnswers: answers as unknown as Episode['focusAnswers'], status: 'focusing' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 3 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Episode focus</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Three questions that will shape everything — the questions, the script, the whole conversation.</p>
      </div>

      <div className="space-y-5">
        {FOCUS_QUESTIONS.map((q, i) => (
          <div key={q} className="flex flex-col gap-2">
            <label className="body-sm text-[var(--ink-2)]">{q}</label>
            <Textarea
              value={answers[i] ?? ''}
              onChange={e => setAnswer(i, e.target.value)}
              rows={3}
              className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
              placeholder="Your answer…"
            />
          </div>
        ))}
      </div>

      <PillButton onClick={handleNext}>
        Next <ArrowRight size={14} />
      </PillButton>
    </div>
  )
}

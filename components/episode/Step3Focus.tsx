'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import { ArrowRight } from 'lucide-react'
import { FOCUS_QUESTIONS } from '@/lib/focus-questions'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

export function Step3Focus({ episode, onNext }: Props) {
  const initialAnswers = (episode?.focusAnswers as string[] | null) ?? ['', '', '', '', '']
  const [answers, setAnswers] = useState<string[]>(() =>
    FOCUS_QUESTIONS.map((_, i) => initialAnswers[i] ?? '')
  )

  function setAnswer(i: number, v: string) {
    setAnswers(prev => prev.map((a, idx) => idx === i ? v : a))
  }

  const answeredCount = answers.filter(a => a.trim()).length
  const canProceed = answeredCount >= 2

  async function handleNext() {
    if (!canProceed) return
    await onNext({ focusAnswers: answers as unknown as Episode['focusAnswers'], status: 'focusing' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 3 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Focus the interview</h2>
        <p className="body mt-1 text-[var(--ink-2)]">
          These shape every question and the whole script. Answer at least two - more is better.
        </p>
      </div>

      <div className="space-y-5">
        {FOCUS_QUESTIONS.map((q, i) => (
          <div key={q.label} className="flex flex-col gap-2">
            <label className="body-sm text-[var(--ink-2)]">
              <span className="mr-1">{q.emoji}</span> {q.label}
            </label>
            <Textarea
              value={answers[i] ?? ''}
              onChange={e => setAnswer(i, e.target.value)}
              rows={2}
              className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
              placeholder={q.placeholder}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <PillButton onClick={handleNext} disabled={!canProceed}>
          Next <ArrowRight size={14} />
        </PillButton>
        {!canProceed && (
          <p className="body-sm text-[var(--ink-3)]">Answer at least 2 to continue ({answeredCount}/2).</p>
        )}
      </div>
    </div>
  )
}

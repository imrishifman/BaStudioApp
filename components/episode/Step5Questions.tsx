'use client'

import { useState, useEffect } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, Star, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  text: string
  section: string
  isFavorite?: boolean
  isRepeat?: boolean
}

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

export function Step5Questions({ episode, show, onNext }: Props) {
  const [questions, setQuestions] = useState<Question[]>(() => {
    const stored = episode?.generatedQuestions as Question[] | null
    return stored ?? []
  })
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = episode?.favoriteQuestions as string[] | null
    return stored ?? []
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!episode?.id || questions.length > 0) return
    generateQuestions()
  }, [episode?.id])

  async function generateQuestions() {
    if (!episode?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: episode.id, showId: episode.showId, focusAnswers: episode.focusAnswers }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      const qs: Question[] = data.questions ?? []
      setQuestions(qs)
    } catch {
      toast.error('Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  function toggleFavorite(id: string) {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  async function handleNext() {
    await onNext({
      generatedQuestions: questions as unknown as Episode['generatedQuestions'],
      favoriteQuestions: favorites as unknown as Episode['favoriteQuestions'],
      status: 'intro',
    })
  }

  const grouped = questions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = []
    acc[q.section].push(q)
    return acc
  }, {} as Record<string, Question[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 5 of 10</p>
          <h2 className="display-sm text-[var(--ink-1)]">Questions</h2>
          <p className="body mt-1 text-[var(--ink-2)]">
            AI-generated questions mapped to your episode structure. Star your favourites.
          </p>
        </div>
        <PillButton variant="secondary" size="sm" onClick={generateQuestions} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
        </PillButton>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Sparkles size={32} className="animate-pulse text-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Generating questions…</p>
        </GlassCard>
      ) : questions.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <PillButton onClick={generateQuestions}><Sparkles size={14} /> Generate questions</PillButton>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([section, qs]) => (
            <div key={section}>
              <p className="eyebrow mb-3 text-[var(--ink-3)]">{section}</p>
              <div className="space-y-2">
                {qs.map(q => (
                  <GlassCard key={q.id} className="flex items-start gap-3 p-4">
                    {q.isRepeat && (
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                    )}
                    <p className="body flex-1 text-[var(--ink-1)]">{q.text}</p>
                    <button
                      onClick={() => toggleFavorite(q.id)}
                      className="shrink-0 transition-colors"
                      style={{ color: favorites.includes(q.id) ? 'var(--warning)' : 'var(--ink-4)' }}
                      aria-label="Favourite"
                    >
                      <Star size={16} fill={favorites.includes(q.id) ? 'currentColor' : 'none'} />
                    </button>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <PillButton onClick={handleNext}>
          Next <ArrowRight size={14} />
        </PillButton>
      )}
    </div>
  )
}

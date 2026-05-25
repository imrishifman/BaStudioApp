'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAILoading } from './AILoadingContext'
import { postAI } from '@/lib/ai-client'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

// 16 well-known interviewers to emulate.
const INFLUENCERS = [
  'Lex Fridman', 'Tim Ferriss', 'Brené Brown', 'Joe Rogan',
  'Oprah Winfrey', 'Howard Stern', 'Terry Gross', 'Marc Maron',
  'Krista Tippett', 'Cal Fussman', 'Guy Raz', 'Dax Shepard',
  'Trevor Noah', 'Conan O’Brien', 'Esther Perel', 'Ezra Klein',
]

const MAX = 3

export function Step4Style({ episode, onNext }: Props) {
  const { runAI } = useAILoading()
  const [selected, setSelected] = useState<string[]>(episode?.interviewInfluences ?? [])
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)

  function toggle(name: string) {
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(v => v !== name)
        : prev.length >= MAX ? prev : [...prev, name]
    )
  }

  function addCustom() {
    const name = custom.trim()
    if (!name) return
    if (selected.length >= MAX) { toast.error(`Pick up to ${MAX}`); return }
    if (!selected.includes(name)) setSelected(prev => [...prev, name])
    setCustom('')
  }

  async function generateQuestions() {
    if (!episode?.id) return
    setLoading(true)
    try {
      await runAI('questions', async (signal) =>
        postAI('/api/ai/questions', {
          episodeId: episode.id,
          showId: episode.showId,
          focusAnswers: episode.focusAnswers,
          influences: selected,
        }, signal)
      )
      // Questions are saved server-side; advance to the selection step.
      await onNext({ interviewInfluences: selected, status: 'questions' })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Could not generate questions')
      }
    } finally {
      setLoading(false)
    }
  }

  const customSelected = selected.filter(s => !INFLUENCERS.includes(s))

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 4 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Interview style</h2>
        <p className="body mt-1 text-[var(--ink-2)]">
          Pick up to {MAX} interviewers whose style should shape your questions ({selected.length}/{MAX}).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INFLUENCERS.map(name => {
          const active = selected.includes(name)
          return (
            <GlassCard
              key={name}
              onClick={() => toggle(name)}
              className={cn('flex cursor-pointer items-center gap-2 p-3 transition-all')}
              style={active ? { borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' } : undefined}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: active ? 'var(--accent-violet)' : 'transparent', border: `1px solid ${active ? 'var(--accent-violet)' : 'var(--line-2)'}` }}
              >
                {active && <Check size={10} color="white" />}
              </span>
              <span className="body-sm text-[var(--ink-1)]">{name}</span>
            </GlassCard>
          )
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Add a custom name…"
          className="body-sm flex-1 rounded-[var(--radius-sm)] px-3 py-2"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
        />
        <PillButton variant="secondary" size="sm" onClick={addCustom}><Plus size={14} /> Add</PillButton>
      </div>

      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customSelected.map(s => (
            <span key={s} className="body-sm rounded-full px-3 py-1" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--accent-violet)' }}>
              {s}
              <button onClick={() => toggle(s)} className="ml-2 opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}

      <PillButton onClick={generateQuestions} disabled={loading} size="lg">
        <Sparkles size={16} /> Generate Questions
      </PillButton>
    </div>
  )
}

'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Star, RefreshCw, ArrowRight, Lock, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAILoading } from './AILoadingContext'
import {
  normalizeGenerated,
  resolveSections,
  sortedWithIndex,
  DEFAULT_CLOSING_QUESTION,
  type GeneratedMap,
} from '@/lib/questions'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

type IdxMap = Record<string, number[]>

const toggle = (arr: number[] = [], v: number) =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

export function Step5Questions({ episode, show, onNext }: Props) {
  const { runAI } = useAILoading()

  const [generated, setGenerated] = useState<GeneratedMap>(
    () => normalizeGenerated(episode?.generatedQuestions).map
  )
  const [storedSections, setStoredSections] = useState(
    () => normalizeGenerated(episode?.generatedQuestions).storedSections
  )
  const [selected, setSelected] = useState<IdxMap>(() => {
    const s = episode?.selectedQuestions
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const { _closing, ...rest } = s as Record<string, unknown>
      return rest as IdxMap
    }
    return {}
  })
  const [favorites, setFavorites] = useState<IdxMap>(() => {
    const f = episode?.favoriteQuestions
    return f && typeof f === 'object' && !Array.isArray(f) ? (f as IdxMap) : {}
  })
  const [closing, setClosing] = useState(() => {
    const custom = (episode?.selectedQuestions as { _closing?: string } | null)?._closing
    return custom ?? show?.closingQuestion ?? DEFAULT_CLOSING_QUESTION
  })
  const [editingClosing, setEditingClosing] = useState(false)
  const [edit, setEdit] = useState<{ key: string; idx: number; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const sections = useMemo(
    () => resolveSections(show?.episodeSections, storedSections),
    [show?.episodeSections, storedSections]
  )

  const hasAny = sections.some((s) => (generated[s.key]?.length ?? 0) > 0)
  const lastKey = sections[sections.length - 1]?.key

  useEffect(() => {
    if (!episode?.id || hasAny) return
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id])

  function serializeGenerated(map: GeneratedMap) {
    return { ...map, _sections: sections }
  }

  async function generate() {
    if (!episode?.id) return
    setLoading(true)
    try {
      const data = await runAI('questions', async (signal) => {
        const res = await fetch('/api/ai/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ episodeId: episode.id, showId: episode.showId, focusAnswers: episode.focusAnswers }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        return json
      })
      const norm = normalizeGenerated(data.questions)
      setGenerated(norm.map)
      setStoredSections(norm.storedSections)
      setSelected({})
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Failed to generate questions')
      }
    } finally {
      setLoading(false)
    }
  }

  async function persistGenerated(map: GeneratedMap) {
    if (!episode?.id) return
    try {
      await fetch(`/api/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedQuestions: serializeGenerated(map) }),
      })
    } catch {
      toast.error('Could not save the edit')
    }
  }

  function saveEdit() {
    if (!edit) return
    const text = edit.text.trim()
    if (!text) { setEdit(null); return }
    setGenerated((prev) => {
      const next = { ...prev, [edit.key]: prev[edit.key].map((q, i) => (i === edit.idx ? { ...q, question: text } : q)) }
      persistGenerated(next)
      return next
    })
    setEdit(null)
  }

  // Every section that has questions must have at least one selected.
  const canProceed = sections.every((s) => {
    const qs = generated[s.key]
    if (!qs || qs.length === 0) return true
    return (selected[s.key]?.length ?? 0) > 0
  })

  async function handleNext() {
    await onNext({
      selectedQuestions: { ...selected, _closing: closing } as unknown as Episode['selectedQuestions'],
      favoriteQuestions: favorites as unknown as Episode['favoriteQuestions'],
      status: 'intro',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 5 of 10</p>
          <h2 className="display-sm text-[var(--ink-1)]">Questions</h2>
          <p className="body mt-1 text-[var(--ink-2)]">
            Pick the questions you want, strongest first. Tap a card to select it.
          </p>
        </div>
        {hasAny && (
          <PillButton variant="secondary" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
          </PillButton>
        )}
      </div>

      {!hasAny ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="body text-[var(--ink-2)]">No questions yet.</p>
          <PillButton onClick={generate} disabled={loading}><Sparkles size={14} /> Generate questions</PillButton>
        </GlassCard>
      ) : (
        <div className="space-y-7">
          {sections.map((section) => {
            const qs = generated[section.key] ?? []
            if (qs.length === 0 && section.key !== lastKey) return null
            const ordered = sortedWithIndex(qs)
            const selCount = selected[section.key]?.length ?? 0
            return (
              <div key={section.key}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="eyebrow text-[var(--ink-3)]">{section.name}</p>
                  {qs.length > 0 && (
                    <span className="body-sm text-[var(--ink-4)]">{selCount}/{qs.length} selected</span>
                  )}
                </div>
                <div className="space-y-2">
                  {ordered.map(({ q, originalIdx }, displayIdx) => {
                    const isSel = selected[section.key]?.includes(originalIdx) ?? false
                    const isFav = favorites[section.key]?.includes(originalIdx) ?? false
                    const isEditing = edit?.key === section.key && edit?.idx === originalIdx
                    return (
                      <motion.div
                        key={originalIdx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(displayIdx, 10) * 0.04 }}
                      >
                        <GlassCard
                          onClick={() => !isEditing && setSelected((p) => ({ ...p, [section.key]: toggle(p[section.key], originalIdx) }))}
                          className={cn('flex items-start gap-3 p-4 transition-colors', !isEditing && 'cursor-pointer')}
                          style={isSel ? { borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' } : undefined}
                        >
                          <span
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                            style={{ borderColor: isSel ? 'var(--accent-violet)' : 'var(--line-2)', background: isSel ? 'var(--accent-violet)' : 'transparent' }}
                          >
                            {isSel && <Check size={12} className="text-white" />}
                          </span>

                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                                <Textarea
                                  value={edit.text}
                                  onChange={(e) => setEdit({ ...edit, text: e.target.value })}
                                  rows={2}
                                  className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]"
                                />
                                <div className="flex gap-2">
                                  <PillButton size="sm" onClick={saveEdit}><Check size={13} /> Save</PillButton>
                                  <button onClick={() => setEdit(null)} className="body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)]">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="body text-[var(--ink-1)]">{q.question}</p>
                                {q.context && <p className="body-sm mt-1 text-[var(--ink-4)]">{q.context}</p>}
                              </>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setEdit({ key: section.key, idx: originalIdx, text: q.question })}
                                className="rounded-full p-1.5 text-[var(--ink-4)] transition-colors hover:text-[var(--ink-1)]"
                                aria-label="Edit question"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => setFavorites((p) => ({ ...p, [section.key]: toggle(p[section.key], originalIdx) }))}
                                className="rounded-full p-1.5 transition-transform active:scale-90"
                                style={{ color: isFav ? 'var(--warning)' : 'var(--ink-4)' }}
                                aria-label="Favourite"
                              >
                                <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                              </button>
                            </div>
                          )}
                        </GlassCard>
                      </motion.div>
                    )
                  })}

                  {/* Locked signature closing on the last section */}
                  {section.key === lastKey && (
                    <GlassCard
                      className="flex items-start gap-3 p-4"
                      style={{ borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' }}
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'var(--accent-violet)' }}
                      >
                        <Lock size={11} className="text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {editingClosing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={closing}
                              onChange={(e) => setClosing(e.target.value)}
                              rows={2}
                              className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]"
                            />
                            <PillButton size="sm" onClick={() => setEditingClosing(false)}><Check size={13} /> Done</PillButton>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <p className="body-sm font-semibold text-[var(--accent-violet)]">Signature closing</p>
                              <button onClick={() => setEditingClosing(true)} className="body-sm text-[var(--ink-3)] underline hover:text-[var(--ink-1)]">Change</button>
                            </div>
                            <p className="body mt-1 text-[var(--ink-1)]">{closing}</p>
                          </>
                        )}
                      </div>
                    </GlassCard>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasAny && (
        <PillButton onClick={handleNext} disabled={!canProceed}>
          Build My Intro! <ArrowRight size={14} />
        </PillButton>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, ArrowRight, RefreshCw, Telescope } from 'lucide-react'
import { toast } from 'sonner'
import { useAILoading } from './AILoadingContext'
import { SmartTextarea } from './SmartTextarea'
import { postAI } from '@/lib/ai-client'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

export function Step2GuestBio({ episode, onNext }: Props) {
  const { runAI } = useAILoading()
  const [bio, setBio] = useState(episode?.guestBio ?? '')
  const [research, setResearch] = useState(episode?.guestResearch ?? '')
  const [funFacts, setFunFacts] = useState<string[]>((episode?.funFacts as string[]) ?? [])
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [showResearch, setShowResearch] = useState(false)
  // Deep research is a one-time pass.
  const [deepDone, setDeepDone] = useState(() => (episode?.guestResearch ?? '').includes('Deep research'))

  useEffect(() => {
    if (!episode?.id || episode.guestResearch) return
    runResearch('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id])

  async function runResearch(mode: 'initial' | 'deep') {
    if (!episode?.id) return
    setLoading(true)
    try {
      // Split into two phases so each Vercel function call fits in 60s:
      //   1) research (web search) → saves guestResearch
      //   2) derive  (bio + facts in parallel from saved research)
      // Plus a best-effort intro draft on the initial pass.
      const data = await runAI('research', async (signal) => {
        const r = await postAI<{ research?: string }>('/api/ai/research', {
          episodeId: episode.id,
          guestName: episode.guestName,
          mode,
          phase: 'research',
        }, signal)
        const d = await postAI<{ bio?: string; funFacts?: string[] }>('/api/ai/research', {
          episodeId: episode.id,
          guestName: episode.guestName,
          mode,
          phase: 'derive',
        }, signal)
        if (mode === 'initial' && !episode.introductionScript) {
          try {
            await postAI('/api/ai/script', { episodeId: episode.id, showId: episode.showId, kind: 'intro', setStatus: false }, signal)
          } catch { /* bonus */ }
        }
        return { ...r, ...d }
      })
      setBio(data.bio ?? bio)
      setResearch(data.research ?? research)
      if (data.funFacts) setFunFacts(data.funFacts)
      if (mode === 'deep') setDeepDone(true)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Research failed')
      }
    } finally {
      setLoading(false)
    }
  }

  async function regenerateBio() {
    if (!episode?.id) return
    setRegenLoading(true)
    try {
      const data = await postAI<{ bio?: string }>('/api/ai/research', {
        episodeId: episode.id,
        guestName: episode.guestName,
        mode: 'regenerate-bio',
      })
      if (data.bio) setBio(data.bio)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate')
    } finally {
      setRegenLoading(false)
    }
  }

  async function handleNext() {
    await onNext({ guestBio: bio, guestResearch: research, status: 'focusing' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 2 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Review the research</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Web-researched and fact-checked. Edit anything, or dig deeper.</p>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Researching {episode?.guestName}…</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="body-sm text-[var(--ink-2)]">Quick bio</label>
              <button onClick={regenerateBio} disabled={regenLoading} className="body-sm flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink-1)] disabled:opacity-50">
                <RefreshCw size={12} className={regenLoading ? 'animate-spin' : ''} /> Regenerate
              </button>
            </div>
            <SmartTextarea value={bio} onChange={setBio} rows={3} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>

          {funFacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="body-sm text-[var(--ink-2)]">Fun facts</label>
              <GlassCard className="space-y-1.5 p-4">
                {funFacts.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[var(--accent-violet)]">•</span>
                    <p className="body-sm text-[var(--ink-2)]">{f}</p>
                  </div>
                ))}
              </GlassCard>
            </div>
          )}

          <div>
            <button onClick={() => setShowResearch(s => !s)} className="body-sm text-[var(--ink-3)] underline hover:text-[var(--ink-1)]">
              {showResearch ? 'Hide' : 'Show'} full research
            </button>
            {showResearch && (
              <div className="mt-2">
                <SmartTextarea value={research} onChange={setResearch} rows={10} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <PillButton variant="secondary" size="sm" onClick={() => runResearch('deep')} disabled={deepDone}>
              <Telescope size={14} /> {deepDone ? 'Deep research done' : 'Deep research'}
            </PillButton>
          </div>
        </div>
      )}

      {!loading && (
        <PillButton onClick={handleNext} disabled={!bio}>
          Next <ArrowRight size={14} />
        </PillButton>
      )}
    </div>
  )
}

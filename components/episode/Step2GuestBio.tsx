'use client'

import { useState, useEffect } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAILoading } from './AILoadingContext'
import { SmartTextarea } from './SmartTextarea'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

export function Step2GuestBio({ episode, show, onNext }: Props) {
  const { runAI } = useAILoading()
  const [bio, setBio] = useState(episode?.guestBio ?? '')
  const [research, setResearch] = useState(episode?.guestResearch ?? '')
  const [loading, setLoading] = useState(false)
  const [deepLoading, setDeepLoading] = useState(false)

  // Auto-run research if not done yet
  useEffect(() => {
    if (!episode?.id || episode.guestResearch) return
    runResearch('initial')
  }, [episode?.id])

  async function runResearch(mode: 'initial' | 'deep') {
    if (!episode?.id) return
    mode === 'initial' ? setLoading(true) : setDeepLoading(true)
    try {
      const data = await runAI('research', async (signal) => {
        const res = await fetch('/api/ai/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({ episodeId: episode.id, guestName: episode.guestName, links: [episode.guestLinkedinUrl, episode.guestWebsiteUrl].filter(Boolean), mode }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        // Draft a DNA-aware intro early (best-effort) without advancing status —
        // it stays refinable on the Intro step. The research is already saved,
        // so the intro generator reads it from the DB.
        if (mode === 'initial' && !episode.introductionScript) {
          try {
            await fetch('/api/ai/script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal,
              body: JSON.stringify({ episodeId: episode.id, showId: episode.showId, kind: 'intro', setStatus: false }),
            })
          } catch { /* the early intro draft is a bonus */ }
        }
        return json
      })
      setBio(data.bio ?? bio)
      setResearch(data.research ?? research)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Research failed')
      }
    } finally {
      mode === 'initial' ? setLoading(false) : setDeepLoading(false)
    }
  }

  async function handleNext() {
    await onNext({ guestBio: bio, guestResearch: research, status: 'focusing' })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 2 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Guest bio & research</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Review and edit the AI-generated research. Hit "Go deeper" for more detail.</p>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Researching {episode?.guestName}…</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="body-sm text-[var(--ink-2)]">Guest bio</label>
            <SmartTextarea value={bio} onChange={setBio} rows={4} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="body-sm text-[var(--ink-2)]">Research notes</label>
            <SmartTextarea value={research} onChange={setResearch} rows={8} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>
          <div className="flex gap-3">
            <PillButton variant="secondary" size="sm" onClick={() => runResearch('deep')} disabled={deepLoading}>
              {deepLoading ? 'Researching…' : <><Sparkles size={14} /> Go deeper</>}
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

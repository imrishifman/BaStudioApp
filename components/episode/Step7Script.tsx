'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Episode, Show } from '@prisma/client'
import { SmartTextarea } from './SmartTextarea'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, ArrowRight, RefreshCw, Download, Wand2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAILoading } from './AILoadingContext'
import { postAI } from '@/lib/ai-client'
import { downloadScriptDocx } from '@/lib/docx-export'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

export function Step7Script({ episode, onNext }: Props) {
  const { runAI } = useAILoading()
  const [script, setScript] = useState(episode?.fullScript ?? '')
  const [loading, setLoading] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [revising, setRevising] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [photoUrl, setPhotoUrl] = useState<string | null>(episode?.guestPhotoUrl ?? null)
  const [photoLoading, setPhotoLoading] = useState(false)

  useEffect(() => {
    if (!episode?.fullScript) generate()
    // Background, non-blocking photo search if none yet.
    if (episode?.id && !episode.guestPhotoUrl) findPhoto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id])

  async function generate() {
    if (!episode?.id) return
    setLoading(true)
    try {
      const data = await runAI('script', async (signal) => {
        const json = await postAI<{ script?: string }>('/api/ai/script', { episodeId: episode.id, showId: episode.showId, kind: 'full' }, signal)
        if (!json.script) throw new Error('Generation failed')
        return json
      })
      setScript(data.script as string)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'Failed to generate')
    } finally { setLoading(false) }
  }

  async function applyRevision() {
    if (!episode?.id || !instruction.trim()) return
    setRevising(true)
    const req = instruction.trim()
    try {
      const data = await postAI<{ script?: string }>('/api/ai/script', { episodeId: episode.id, instruction: req, currentScript: script })
      if (data.script) {
        setHistory(h => [...h, req])
        setScript(data.script)
        setInstruction('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revision failed')
    } finally { setRevising(false) }
  }

  async function findPhoto() {
    if (!episode?.id) return
    setPhotoLoading(true)
    try {
      const data = await postAI<{ photoUrl?: string | null }>('/api/ai/photo', { guestName: episode.guestName })
      if (data.photoUrl) setPhotoUrl(data.photoUrl)
    } catch { /* non-blocking */ } finally { setPhotoLoading(false) }
  }

  async function confirmPhoto() {
    if (!episode?.id || !photoUrl) return
    try {
      await fetch(`/api/episodes/${episode.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestPhotoUrl: photoUrl }) })
      toast.success('Photo saved')
    } catch { toast.error('Could not save photo') }
  }

  function exportDocx() {
    if (!script) return
    downloadScriptDocx(
      {
        title: `${episode?.guestName ?? 'Episode'} - Interview Script`,
        subtitle: episode?.title ?? undefined,
      },
      script,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 7 of 10</p>
          <h2 className="display-sm text-[var(--ink-1)]">Full script</h2>
          <p className="body mt-1 text-[var(--ink-2)]">Your complete interview guide. Edit freely, ask for changes, or export.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <PillButton variant="secondary" size="sm" onClick={exportDocx} disabled={!script || loading}>
            <Download size={14} /> .docx
          </PillButton>
          <PillButton variant="secondary" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
          </PillButton>
        </div>
      </div>

      {/* Guest photo suggestion */}
      {!loading && (photoUrl || photoLoading) && (
        <GlassCard className="flex items-center gap-3 p-3">
          {photoLoading ? (
            <p className="body-sm text-[var(--ink-3)]"><ImageIcon size={14} className="mr-1 inline" /> Looking for a guest photo…</p>
          ) : photoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={episode?.guestName ?? ''} className="h-12 w-12 rounded-full object-cover" />
              <p className="body-sm flex-1 text-[var(--ink-2)]">Found a possible guest photo.</p>
              {episode?.guestPhotoUrl !== photoUrl && (
                <PillButton size="sm" onClick={confirmPhoto}>Use it</PillButton>
              )}
              <button onClick={() => setPhotoUrl(null)} className="body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)]">Skip</button>
            </>
          ) : null}
        </GlassCard>
      )}

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Sparkles size={32} className="animate-pulse text-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Writing your script…</p>
          <p className="body-sm text-[var(--ink-3)]">This takes about 30 seconds</p>
        </GlassCard>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <SmartTextarea value={script} onChange={setScript} rows={20} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] leading-relaxed font-mono text-sm" placeholder="Your full script will appear here…" />
        </motion.div>
      )}

      {/* Revision chat */}
      {!loading && script && (
        <div className="space-y-2">
          {history.length > 0 && (
            <div className="space-y-1">
              {history.map((h, i) => (
                <p key={i} className="body-sm text-[var(--ink-3)]">↳ {h}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyRevision() } }}
              placeholder='Ask for a change, e.g. "make question 3 more casual"'
              disabled={revising}
              className="body-sm flex-1 rounded-[var(--radius-sm)] px-3 py-2"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
            />
            <PillButton size="sm" onClick={applyRevision} disabled={revising || !instruction.trim()}>
              <Wand2 size={14} /> {revising ? 'Revising…' : 'Revise'}
            </PillButton>
          </div>
        </div>
      )}

      {!loading && <PillButton onClick={() => onNext({ fullScript: script, status: 'review' })} disabled={!script}>Next <ArrowRight size={14} /></PillButton>}
    </div>
  )
}

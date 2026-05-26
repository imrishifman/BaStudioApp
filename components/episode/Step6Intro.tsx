'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Episode, Show } from '@prisma/client'
import { SmartTextarea } from './SmartTextarea'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, ArrowRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAILoading } from './AILoadingContext'
import { postAI } from '@/lib/ai-client'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

export function Step6Intro({ episode, show, onNext }: Props) {
  const { runAI } = useAILoading()
  const [intro, setIntro] = useState(episode?.introductionScript ?? '')
  const [hostName, setHostName] = useState(episode?.hostName ?? show?.hostName ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!episode?.introductionScript) generate() }, [episode?.id])

  async function generate() {
    if (!episode?.id) return
    setLoading(true)
    try {
      // Persist the host name so it carries into the full-script step.
      if (hostName.trim() && hostName !== episode.hostName) {
        try {
          await fetch(`/api/episodes/${episode.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostName: hostName.trim() }),
          })
        } catch { /* non-blocking */ }
      }
      const data = await runAI('intro', async (signal) => {
        const json = await postAI<{ script?: string }>('/api/ai/script', { episodeId: episode.id, showId: episode.showId, kind: 'intro' }, signal)
        if (!json.script) throw new Error('Generation failed')
        return json
      })
      setIntro(data.script as string)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'Failed to generate')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 6 of 10</p>
          <h2 className="display-sm text-[var(--ink-1)]">Intro script</h2>
          <p className="body mt-1 text-[var(--ink-2)]">Your opening - edit to match your natural voice.</p>
        </div>
        <PillButton variant="secondary" size="sm" onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
        </PillButton>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="body-sm text-[var(--ink-2)]">
          Host name {show?.hostName && <span className="text-[var(--ink-4)]">(from "{show.name}")</span>}
        </label>
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder={show?.hostName ?? "What's the host's name?"}
          className="body-sm rounded-[var(--radius-sm)] px-3 py-2"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
        />
        <p className="text-[11px] text-[var(--ink-4)]">Used in the intro and the full script. Regenerate to apply.</p>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Sparkles size={32} className="animate-pulse text-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Writing your intro…</p>
        </GlassCard>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <SmartTextarea value={intro} onChange={setIntro} rows={10} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] leading-relaxed" placeholder="Your intro will appear here…" />
        </motion.div>
      )}

      {!loading && (
        <PillButton
          onClick={() => onNext({ introductionScript: intro, hostName: hostName.trim() || null, status: 'script' })}
          disabled={!intro}
        >
          Next <ArrowRight size={14} />
        </PillButton>
      )}
    </div>
  )
}

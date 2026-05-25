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

export function Step7Script({ episode, onNext }: Props) {
  const { runAI } = useAILoading()
  const [script, setScript] = useState(episode?.fullScript ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!episode?.fullScript) generate() }, [episode?.id])

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 7 of 10</p>
          <h2 className="display-sm text-[var(--ink-1)]">Full script</h2>
          <p className="body mt-1 text-[var(--ink-2)]">Complete interview script. Edit freely — this is your document.</p>
        </div>
        <PillButton variant="secondary" size="sm" onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
        </PillButton>
      </div>

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

      {!loading && <PillButton onClick={() => onNext({ fullScript: script, status: 'review' })} disabled={!script}>Next <ArrowRight size={14} /></PillButton>}
    </div>
  )
}

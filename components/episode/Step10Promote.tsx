'use client'

import { useState, useEffect } from 'react'
import type { Episode, Show } from '@prisma/client'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SocialContent { linkedin_post?: string; twitter_thread?: string; instagram_caption?: string; episode_description?: string }

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

const TABS = [
  { key: 'linkedin_post', label: 'LinkedIn' },
  { key: 'twitter_thread', label: 'Twitter / X' },
  { key: 'instagram_caption', label: 'Instagram' },
  { key: 'episode_description', label: 'Show notes' },
] as const

export function Step10Promote({ episode, onNext }: Props) {
  const [content, setContent] = useState<SocialContent>((episode?.socialContent as SocialContent) ?? {})
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>('linkedin_post')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!episode?.socialContent) generate()
  }, [episode?.id])

  async function generate() {
    if (!episode?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeId: episode.id, showId: episode.showId }) })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setContent(data)
    } catch { toast.error('Generation failed') } finally { setLoading(false) }
  }

  async function handleDone() {
    await onNext({ socialContent: content as unknown as Episode['socialContent'], status: 'published' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">Final step</p>
          <h2 className="display-sm text-[var(--ink-1)]">Promote your episode</h2>
          <p className="body mt-1 text-[var(--ink-2)]">Social posts and show notes, ready to copy.</p>
        </div>
        <PillButton variant="secondary" size="sm" onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Regenerate
        </PillButton>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Sparkles size={32} className="animate-pulse text-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Creating your social content…</p>
        </GlassCard>
      ) : (
        <div>
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'body-sm whitespace-nowrap rounded-full px-4 py-1.5 font-semibold transition-all',
                  activeTab === tab.key ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Textarea
            value={content[activeTab] ?? ''}
            onChange={e => setContent(prev => ({ ...prev, [activeTab]: e.target.value }))}
            rows={12}
            className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]"
            placeholder={`${TABS.find(t => t.key === activeTab)?.label} content will appear here…`}
          />
        </div>
      )}

      {!loading && (
        <div className="flex items-center gap-3">
          <PillButton onClick={handleDone}>
            <CheckCircle2 size={14} /> Done — episode published
          </PillButton>
          <button onClick={() => onNext()} className="body-sm text-[var(--ink-3)] underline hover:text-[var(--ink-1)]">
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

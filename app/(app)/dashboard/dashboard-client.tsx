'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Episode } from '@prisma/client'
import type { Session } from 'next-auth'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-4)', researching: 'var(--accent-violet)', focusing: 'var(--accent-cyan)',
  questions: 'var(--accent-cyan)', intro: 'var(--accent-pink)', script: 'var(--accent-pink)',
  video: 'var(--warning)', review: 'var(--warning)', approved: 'var(--success)', published: 'var(--success)',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', researching: 'Researching', focusing: 'Focus', questions: 'Questions',
  intro: 'Intro', script: 'Script', video: 'Video', review: 'Review',
  approved: 'Approved', published: 'Published',
}

interface Props {
  episodes: Episode[]
  sessionUser: Session['user']
}

export function DashboardClient({ episodes, sessionUser }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'active' | 'published'>('all')

  const filtered = episodes.filter(ep => {
    if (filter === 'active') return !['published', 'approved'].includes(ep.status)
    if (filter === 'published') return ep.status === 'published'
    return true
  })

  const awaitingReview = episodes.filter(ep => ep.status === 'review')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="display-sm text-[var(--ink-1)]">Episodes</h1>
        <div className="flex gap-2">
          <PillButton variant="secondary" size="sm" onClick={() => router.push('/episodes/new')}>
            <Plus size={14} /> New episode
          </PillButton>
        </div>
      </div>

      {/* Approval banner */}
      {awaitingReview.length > 0 && (
        <GlassCard className="flex items-center justify-between gap-4 p-4" style={{ borderColor: 'rgba(255,214,10,0.3)' }}>
          <p className="body text-[var(--ink-1)]">
            {awaitingReview.length} episode{awaitingReview.length !== 1 ? 's' : ''} awaiting your review
          </p>
          <Link href={`/episodes/${awaitingReview[0].id}`} className="pill-primary pill-primary-sm">
            Review <ChevronRight size={14} />
          </Link>
        </GlassCard>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1" style={{ background: 'var(--bg-1)', borderRadius: 'var(--radius-sm)', padding: 4, display: 'inline-flex' }}>
        {(['all', 'active', 'published'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="body-sm rounded-[6px] px-3 py-1.5 font-semibold capitalize transition-all"
            style={filter === f ? { background: 'var(--ink-1)', color: 'var(--bg-0)' } : { color: 'var(--ink-3)' }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Episode grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="display-sm text-[var(--ink-1)]">No episodes yet</p>
          <p className="body text-[var(--ink-2)]">Create your first episode to get started.</p>
          <PillButton onClick={() => router.push('/episodes/new')}>
            <Plus size={14} /> New episode
          </PillButton>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(ep => <EpisodeCard key={ep.id} episode={ep} />)}
        </div>
      )}
    </div>
  )
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const stepLabels = ['', 'Guest', 'Bio', 'Focus', 'Style', 'Questions', 'Intro', 'Script', 'Video', 'Share', 'Promote']
  const currentStepLabel = stepLabels[episode.currentStep] ?? `Step ${episode.currentStep}`

  return (
    <Link href={`/episodes/${episode.id}`}>
      <GlassCard hover className="flex flex-col gap-3 p-5">
        {/* Cover placeholder */}
        <div
          className="aspect-video rounded-[var(--radius-sm)]"
          style={{ background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {episode.guestPhotoUrl ? (
            <img src={episode.guestPhotoUrl} alt="" className="h-full w-full rounded-[var(--radius-sm)] object-cover" />
          ) : (
            <p className="text-2xl font-bold text-[var(--ink-4)]">
              {episode.guestName.slice(0, 2).toUpperCase()}
            </p>
          )}
        </div>

        <div>
          <p className="body font-semibold text-[var(--ink-1)] line-clamp-1">
            {episode.title ?? episode.guestName}
          </p>
          <p className="body-sm text-[var(--ink-3)] line-clamp-1">
            {episode.guestName}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className="body-sm rounded-full px-2.5 py-0.5 font-semibold"
            style={{ background: `${STATUS_COLOR[episode.status]}18`, color: STATUS_COLOR[episode.status] }}
          >
            {STATUS_LABEL[episode.status]}
          </span>
          <span className="body-sm text-[var(--ink-3)]">
            Step {episode.currentStep} · {currentStepLabel}
          </span>
        </div>
      </GlassCard>
    </Link>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Episode } from '@prisma/client'
import type { Session } from 'next-auth'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Plus, ChevronRight, Pencil, Trash2, X, Check as CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
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
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} episode${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/episodes/${id}`, { method: 'DELETE' })))
      toast.success(`Deleted ${selectedIds.size}`)
      setSelectedIds(new Set()); setEditMode(false); router.refresh()
    } catch { toast.error('Could not delete some episodes') } finally { setDeleting(false) }
  }

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
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={deleteSelected}
                disabled={deleting || selectedIds.size === 0}
                className="body-sm flex items-center gap-1 rounded-full px-3 py-1 font-semibold disabled:opacity-50"
                style={{ background: 'var(--error)', color: '#fff' }}
              >
                <Trash2 size={13} /> Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
              <button
                onClick={() => { setEditMode(false); setSelectedIds(new Set()) }}
                className="body-sm flex items-center gap-1 rounded-full border px-3 py-1 text-[var(--ink-2)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <X size={13} /> Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="body-sm flex items-center gap-1 rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              style={{ borderColor: 'var(--line-2)' }}
            >
              <Pencil size={13} /> Edit
            </button>
          )}
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
          {filtered.map(ep => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              shared={ep.createdByEmail !== sessionUser.email}
              editing={editMode}
              selected={selectedIds.has(ep.id)}
              onToggle={() => toggleSelected(ep.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EpisodeCard({
  episode,
  shared,
  editing,
  selected,
  onToggle,
}: {
  episode: Episode
  shared?: boolean
  editing?: boolean
  selected?: boolean
  onToggle?: () => void
}) {
  const stepLabels = ['', 'Guest', 'Bio', 'Focus', 'Style', 'Questions', 'Intro', 'Script', 'Video', 'Share', 'Promote']
  const currentStepLabel = stepLabels[episode.currentStep] ?? `Step ${episode.currentStep}`

  const card = (
    <GlassCard
      hover={!editing}
      onClick={editing ? onToggle : undefined}
      className="flex flex-col gap-3 p-5"
      style={selected ? { borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' } : undefined}
    >
        {/* Cover placeholder */}
        <div
          className="relative aspect-video rounded-[var(--radius-sm)]"
          style={{ background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {episode.guestPhotoUrl ? (
            <img src={episode.guestPhotoUrl} alt="" className="h-full w-full rounded-[var(--radius-sm)] object-cover" />
          ) : (
            <p className="text-2xl font-bold text-[var(--ink-4)]">
              {episode.guestName.slice(0, 2).toUpperCase()}
            </p>
          )}
          {editing && (
            <span
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: selected ? 'var(--accent-violet)' : 'rgba(0,0,0,0.5)', border: `1px solid ${selected ? 'var(--accent-violet)' : 'var(--line-2)'}` }}
            >
              {selected && <CheckIcon size={14} color="white" />}
            </span>
          )}
          {shared && (
            <span
              className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'var(--accent-violet)', color: '#fff' }}
            >
              Shared
            </span>
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
  )
  return editing ? <div>{card}</div> : <Link href={`/episodes/${episode.id}`}>{card}</Link>
}

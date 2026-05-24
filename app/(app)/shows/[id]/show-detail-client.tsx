'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Show, Episode } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { EditShowModal } from '@/components/shows/EditShowModal'
import { ArrowLeft, Settings, Dna, Users } from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

type ShowWithEpisodes = Show & { episodes: Episode[] }

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-4)', researching: 'var(--accent-violet)', questions: 'var(--accent-cyan)',
  script: 'var(--accent-pink)', review: 'var(--warning)', approved: 'var(--success)', published: 'var(--success)',
}

export function ShowDetailClient({ show }: { show: ShowWithEpisodes }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <p className="body-sm text-[var(--ink-3)]">Shows</p>
      </div>

      {/* Show header */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 rounded-[var(--radius-md)] shrink-0"
              style={{ background: show.coverImageUrl ? undefined : 'var(--bg-3)', backgroundImage: show.coverImageUrl ? `url(${show.coverImageUrl})` : undefined, backgroundSize: 'cover' }}
            />
            <div>
              <h1 className="display-sm text-[var(--ink-1)]">{show.name}</h1>
              {show.hostName && <p className="body text-[var(--ink-3)]">Hosted by {show.hostName}</p>}
              {show.description && <p className="body mt-1 text-[var(--ink-2)]">{show.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <PillButton variant="secondary" size="sm" onClick={() => router.push(`/shows/${show.id}/dna`)}>
              <Dna size={14} /> Podcast DNA
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={() => router.push('/guests')}>
              <Users size={14} /> Guests
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Settings size={14} /> Edit
            </PillButton>
          </div>
        </div>
      </GlassCard>

      {/* Episodes */}
      <div>
        <p className="body mb-3 font-semibold text-[var(--ink-1)]">
          {show.episodes.length} episode{show.episodes.length !== 1 ? 's' : ''}
        </p>
        <div className="space-y-2">
          {show.episodes.map(ep => (
            <Link key={ep.id} href={`/episodes/${ep.id}`}>
              <GlassCard hover className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="body font-medium text-[var(--ink-1)] truncate">{ep.title ?? ep.guestName}</p>
                  <p className="body-sm text-[var(--ink-3)]">{ep.guestName} · {formatDate(ep.updatedAt)}</p>
                </div>
                <span
                  className="body-sm shrink-0 rounded-full px-2.5 py-0.5 font-semibold capitalize"
                  style={{ background: `${STATUS_COLOR[ep.status] ?? 'var(--ink-4)'}18`, color: STATUS_COLOR[ep.status] ?? 'var(--ink-4)' }}
                >
                  {ep.status}
                </span>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      <EditShowModal open={editOpen} onOpenChange={setEditOpen} show={show} onSaved={() => window.location.reload()} />
    </div>
  )
}

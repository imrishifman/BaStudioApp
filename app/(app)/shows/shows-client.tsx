'use client'

import { useState } from 'react'
import { Plus, Mic } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { ShowCard } from '@/components/shows/ShowCard'
import { EditShowModal } from '@/components/shows/EditShowModal'
import { GuestsClient } from '@/app/(app)/guests/guests-client'
import { cn } from '@/lib/utils'
import type { Show, Guest } from '@prisma/client'

type ShowWithEpisodes = Show & { episodes: { status: string }[] }

interface Props {
  shows: ShowWithEpisodes[]
  guests: Guest[]
}

export function ShowsClient({ shows, guests }: Props) {
  const [tab, setTab] = useState<'shows' | 'guests'>('shows')
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
        >
          {(['shows', 'guests'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'body-sm rounded-full px-4 py-1.5 font-semibold capitalize transition-all',
                tab === t ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'shows' && (
          <PillButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New show
          </PillButton>
        )}
      </div>

      {tab === 'shows' ? (
        shows.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'rgba(103,232,249,0.1)' }}
            >
              <Mic size={24} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <p className="display-sm text-[var(--ink-1)]">Create your first show</p>
            <p className="body text-[var(--ink-2)]">
              Organise your episodes, DNA, and team under a show.
            </p>
            <PillButton onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create your first show
            </PillButton>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        )
      ) : (
        <GuestsClient guests={guests} embedded />
      )}

      <EditShowModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        show={null}
        onSaved={() => window.location.reload()}
      />
    </div>
  )
}

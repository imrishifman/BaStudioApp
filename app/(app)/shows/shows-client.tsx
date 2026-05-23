'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { ShowCard } from '@/components/shows/ShowCard'
import { EditShowModal } from '@/components/shows/EditShowModal'
import type { Show } from '@prisma/client'

type ShowWithCount = Show & { _count: { episodes: number } }

interface Props { shows: ShowWithCount[] }

export function ShowsClient({ shows }: Props) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <h1 className="display-sm text-[var(--ink-1)]">Shows</h1>
        <PillButton size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New show
        </PillButton>
      </div>

      {shows.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="display-sm text-[var(--ink-1)]">No shows yet</p>
          <p className="body text-[var(--ink-2)]">Create your first show to organise your episodes.</p>
          <PillButton onClick={() => setCreateOpen(true)}><Plus size={14} /> New show</PillButton>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map(show => <ShowCard key={show.id} show={show} episodeCount={show._count.episodes} />)}
        </div>
      )}

      <EditShowModal open={createOpen} onOpenChange={setCreateOpen} show={null} onSaved={() => window.location.reload()} />
    </div>
  )
}

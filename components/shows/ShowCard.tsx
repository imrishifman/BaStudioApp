'use client'

import Link from 'next/link'
import { GlassCard } from '@/components/common/GlassCard'
import type { Show } from '@prisma/client'

interface Props {
  show: Show
  episodeCount: number
}

export function ShowCard({ show, episodeCount }: Props) {
  return (
    <Link href={`/shows/${show.id}`}>
      <GlassCard hover className="flex flex-col gap-3 p-5">
        <div
          className="aspect-video rounded-[var(--radius-sm)]"
          style={{
            background: show.coverImageUrl ? undefined : 'var(--bg-3)',
            backgroundImage: show.coverImageUrl ? `url(${show.coverImageUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div>
          <p className="body font-semibold text-[var(--ink-1)] line-clamp-1">{show.name}</p>
          <p className="body-sm text-[var(--ink-3)]">
            {show.hostName && `${show.hostName} · `}{episodeCount} episode{episodeCount !== 1 ? 's' : ''}
          </p>
        </div>
      </GlassCard>
    </Link>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mic, Plus, ArrowRight } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { initials } from '@/lib/utils'
import type { Show } from '@prisma/client'

type ShowWithEpisodes = Show & { episodes: { status: string }[] }

function dnaPercent(show: Show): number {
  const checks = [
    show.openingLine,
    show.closingQuestion,
    show.targetAudience,
    show.showValues,
    show.aiResearchInstructions,
    show.aiQuestionInstructions,
    show.aiScriptInstructions,
  ]
  const sectionsOk =
    Array.isArray(show.episodeSections) && (show.episodeSections as unknown[]).length > 0
  const filled = checks.filter(Boolean).length + (sectionsOk ? 1 : 0)
  return Math.round((filled / 8) * 100)
}

export function ShowCard({ show }: { show: ShowWithEpisodes }) {
  const router = useRouter()
  const published = show.episodes.filter((e) => e.status === 'published').length
  const inProgress = show.episodes.length - published
  const dna = dnaPercent(show)
  const team = show.memberEmails ?? []

  return (
    <GlassCard className="flex flex-col gap-3 p-5">
      {/* Cover */}
      <div
        className="flex aspect-video items-center justify-center rounded-[var(--radius-sm)]"
        style={{
          background: show.coverImageUrl ? undefined : 'rgba(103,232,249,0.10)',
          backgroundImage: show.coverImageUrl ? `url(${show.coverImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!show.coverImageUrl && <Mic size={28} style={{ color: 'var(--accent-cyan)' }} />}
      </div>

      {/* Title + category */}
      <div>
        <p className="body font-semibold text-[var(--ink-1)] line-clamp-1">{show.name}</p>
        {show.category && (
          <p className="body-sm capitalize text-[var(--ink-3)]">{show.category}</p>
        )}
      </div>

      {/* Episode count pills */}
      <div className="flex flex-wrap gap-2">
        <span
          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ borderColor: 'rgba(48,209,88,0.4)', color: 'var(--success)' }}
        >
          {published} published
        </span>
        <span
          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ borderColor: 'rgba(255,214,10,0.4)', color: 'var(--warning)' }}
        >
          {inProgress} in progress
        </span>
      </div>

      {/* DNA badge */}
      {dna < 75 && (
        <Link
          href={`/shows/${show.id}/dna`}
          className="text-[12px] font-semibold text-[var(--warning)] hover:underline"
        >
          Set up Podcast DNA ({dna}%)
        </Link>
      )}

      {/* Team avatars */}
      {team.length > 0 && (
        <button
          onClick={() => router.push('/team')}
          className="flex items-center -space-x-2"
          aria-label="View team"
        >
          {team.slice(0, 4).map((email) => (
            <span
              key={email}
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold"
              style={{
                background: 'var(--bg-3)',
                borderColor: 'var(--bg-1)',
                color: 'var(--ink-2)',
              }}
            >
              {initials(email.split('@')[0])}
            </span>
          ))}
          {team.length > 4 && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--bg-1)', color: 'var(--ink-3)' }}
            >
              +{team.length - 4}
            </span>
          )}
        </button>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <button
          onClick={() => router.push('/episodes/new')}
          className="body-sm flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
          style={{ borderColor: 'var(--line-2)' }}
        >
          <Plus size={13} /> New Episode
        </button>
        <button
          onClick={() => router.push(`/shows/${show.id}`)}
          className="body-sm flex items-center justify-center gap-1.5 rounded-full px-4 py-2 font-semibold"
          style={{ background: 'var(--ink-1)', color: 'var(--bg-0)' }}
        >
          View <ArrowRight size={13} />
        </button>
      </div>
    </GlassCard>
  )
}

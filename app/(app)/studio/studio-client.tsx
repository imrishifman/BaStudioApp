'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Episode, Show } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { FeatureLockModal } from '@/components/common/FeatureLockModal'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { OnboardingQuest, type QuestStep } from '@/components/onboarding/OnboardingQuest'
import { ProductTour } from '@/components/onboarding/ProductTour'
import { ShowCard } from '@/components/shows/ShowCard'
import { StreakCard } from '@/components/studio/StreakCard'
import { computeStreak } from '@/lib/streak'
import { maxEpisodesPerMonth, episodesThisMonth } from '@/lib/plan-gating'
import { formatDate } from '@/lib/utils'
import { ArrowRight, Plus, Clock, CheckCircle2, Mic2, BookOpen, Pencil, Trash2, X, Check as CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Session } from 'next-auth'

type ShowWithEpisodes = Show & { episodes: { status: string }[] }

interface Props {
  episodes: Episode[]
  shows: ShowWithEpisodes[]
  user: { fullName: string | null; plan: string; onboardingComplete: boolean; skippedDnaSetup: boolean; aiResearchCountThisMonth: number } | null
  guestCount: number
  publishedDates: string[]
  sessionUser: Session['user']
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', researching: 'Researching', focusing: 'Focusing',
  questions: 'Questions', intro: 'Intro', script: 'Script',
  video: 'Video', review: 'Review', approved: 'Approved', published: 'Published',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-3)', researching: 'var(--accent-violet)', focusing: 'var(--accent-cyan)',
  questions: 'var(--accent-cyan)', intro: 'var(--accent-pink)', script: 'var(--accent-pink)',
  video: 'var(--warning)', review: 'var(--warning)', approved: 'var(--success)', published: 'var(--success)',
}

export function StudioClient({ episodes, shows, user, guestCount, publishedDates, sessionUser }: Props) {
  const router = useRouter()
  const [lockOpen, setLockOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(
    !user?.onboardingComplete && !user?.skippedDnaSetup
  )
  const [questDismissed, setQuestDismissed] = useState(false)
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
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/episodes/${id}`, { method: 'DELETE' })
        )
      )
      toast.success(`Deleted ${selectedIds.size}`)
      setSelectedIds(new Set())
      setEditMode(false)
      router.refresh()
    } catch {
      toast.error('Could not delete some episodes')
    } finally {
      setDeleting(false)
    }
  }

  // Onboarding quest - computed from real data, reappears each sign-in until done
  const hasDna = shows.some(
    (s) =>
      !!(s.openingLine || s.closingQuestion || s.targetAudience || s.aiResearchInstructions) ||
      (Array.isArray(s.episodeSections) && (s.episodeSections as unknown[]).length > 0)
  )
  const questSteps: QuestStep[] = [
    { label: 'Set up your first show', done: shows.length > 0, href: '/shows', cta: 'Create' },
    {
      label: 'Define its Podcast DNA',
      done: hasDna,
      href: shows[0] ? `/shows/${shows[0].id}/dna` : '/shows',
      cta: 'Open',
    },
    { label: 'Add your first guest', done: guestCount > 0, href: '/guests', cta: 'View' },
    { label: 'Produce your first episode', done: episodes.length > 0, href: '/episodes/new', cta: 'Start' },
  ]
  const showQuest =
    !questSteps.every((s) => s.done) && !questDismissed && !showOnboarding

  const streak = computeStreak(publishedDates)

  const plan = (user?.plan ?? 'free') as 'free' | 'solo' | 'master'
  const inProgress = episodes.filter(ep => !['published', 'approved'].includes(ep.status))
  const awaiting = episodes.filter(ep => ep.status === 'review' && !ep.managerApproved)
  const monthlyUsed = episodesThisMonth(episodes, sessionUser.email).length
  const maxPerMonth = maxEpisodesPerMonth(plan)

  const totalCount = episodes.length
  const inProgressCount = inProgress.length
  const approvedCount = episodes.filter(ep => ep.status === 'approved').length
  const publishedCount = episodes.filter(ep => ep.status === 'published').length

  function handleNewEpisode() {
    const atLimit = plan !== 'master' && monthlyUsed >= maxPerMonth
    if (atLimit) { setLockOpen(true); return }
    router.push('/episodes/new')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = user?.fullName?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1 text-[var(--ink-3)]">{greeting}, {name}</p>
          <h1 className="display-sm text-[var(--ink-1)]">Studio.</h1>
          {inProgressCount > 0 && (
            <p className="body mt-1 text-[var(--ink-2)]">
              You have {inProgressCount} episode{inProgressCount !== 1 ? 's' : ''} in progress.
            </p>
          )}
        </div>
        <div data-tour="new-episode">
          <PillButton onClick={handleNewEpisode} size="sm">
            <Plus size={14} /> New episode
          </PillButton>
        </div>
      </div>

      {/* Onboarding quest */}
      {showQuest && (
        <OnboardingQuest steps={questSteps} onDismiss={() => setQuestDismissed(true)} />
      )}

      {/* Create banner */}
      {episodes.length === 0 && (
        <GlassCard className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="display-sm mb-1 text-[var(--ink-1)]">Create your first episode</p>
            <p className="body text-[var(--ink-2)]">
              Add a guest name and Ba-Studio handles the research, questions, and script.
            </p>
          </div>
          <PillButton onClick={handleNewEpisode}>Start <ArrowRight size={14} /></PillButton>
        </GlassCard>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total', value: totalCount, icon: BookOpen },
          { label: 'In progress', value: inProgressCount, icon: Clock },
          { label: 'Approved', value: approvedCount, icon: CheckCircle2 },
          { label: 'Published', value: publishedCount, icon: Mic2 },
        ].map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} className="flex flex-col gap-2 p-5">
            <Icon size={16} className="text-[var(--ink-3)]" aria-hidden />
            <p className="display-sm font-bold text-[var(--ink-1)]" style={{ fontSize: 'clamp(28px,3vw,40px)' }}>
              {value}
            </p>
            <p className="body-sm text-[var(--ink-3)]">{label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Publishing streak / weekly challenge */}
      {publishedDates.length > 0 && <StreakCard {...streak} />}

      {/* Plan usage */}
      {plan !== 'master' && (
        <GlassCard className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="body-sm font-semibold text-[var(--ink-1)]">Episodes this month</p>
            <p className="body-sm text-[var(--ink-3)]">
              {monthlyUsed} / {maxPerMonth === Infinity ? '∞' : maxPerMonth}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (monthlyUsed / maxPerMonth) * 100)}%`,
                background: monthlyUsed >= maxPerMonth ? 'var(--error)' : 'var(--accent-violet)',
              }}
            />
          </div>
          {monthlyUsed >= maxPerMonth && (
            <p className="body-sm mt-2 text-[var(--error)]">
              Limit reached.{' '}
              <Link href="/pricing" className="underline">Upgrade to continue.</Link>
            </p>
          )}
        </GlassCard>
      )}

      {/* Shows */}
      {shows.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="body font-semibold text-[var(--ink-1)]">Your shows</p>
            <Link href="/shows" className="body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)]">See all</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shows.slice(0, 3).map(show => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        </div>
      )}

      {/* Awaiting review */}
      {awaiting.length > 0 && (
        <div>
          <p className="body mb-3 font-semibold text-[var(--ink-1)]">Awaiting review</p>
          <div className="space-y-2">
            {awaiting.map(ep => (
              <EpisodeRow key={ep.id} episode={ep} />
            ))}
          </div>
        </div>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="body font-semibold text-[var(--ink-1)]">In progress</p>
            {editMode ? (
              <div className="flex items-center gap-2">
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
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="body-sm flex items-center gap-1 rounded-full border px-3 py-1 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
          <div className="space-y-2">
            {inProgress.slice(0, 6).map(ep => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                editing={editMode}
                selected={selectedIds.has(ep.id)}
                onToggle={() => toggleSelected(ep.id)}
              />
            ))}
          </div>
        </div>
      )}

      <FeatureLockModal open={lockOpen} onOpenChange={setLockOpen} requiredPlan="solo" featureName="More episodes" />
      {showOnboarding && <OnboardingWizard onDone={() => setShowOnboarding(false)} />}
      {!showOnboarding && <ProductTour />}
    </div>
  )
}

function EpisodeRow({
  episode,
  editing,
  selected,
  onToggle,
}: {
  episode: Episode
  editing?: boolean
  selected?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <GlassCard
      hover={!editing}
      onClick={editing ? onToggle : undefined}
      className="flex items-center justify-between gap-4 p-4"
      style={selected ? { borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' } : undefined}
    >
      {editing && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ background: selected ? 'var(--accent-violet)' : 'transparent', border: `1px solid ${selected ? 'var(--accent-violet)' : 'var(--line-2)'}` }}
        >
          {selected && <CheckIcon size={12} color="white" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="body font-medium text-[var(--ink-1)] truncate">
          {episode.title ?? episode.guestName}
        </p>
        <p className="body-sm text-[var(--ink-3)]">
          {episode.guestName} · Updated {formatDate(episode.updatedAt)}
        </p>
      </div>
      <span
        className="body-sm shrink-0 rounded-full px-2.5 py-1 font-semibold"
        style={{ background: `${STATUS_COLOR[episode.status]}18`, color: STATUS_COLOR[episode.status] }}
      >
        {STATUS_LABEL[episode.status]}
      </span>
    </GlassCard>
  )
  return editing ? <div>{inner}</div> : <Link href={`/episodes/${episode.id}`}>{inner}</Link>
}

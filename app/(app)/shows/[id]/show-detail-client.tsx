'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Show, Episode } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { EditShowModal } from '@/components/shows/EditShowModal'
import { EpisodeChatPanel } from '@/components/episode/EpisodeChatPanel'
import {
  ArrowLeft, Settings, Dna, Users, Crown, MessageSquare, Check, Sparkles,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'

type ShowWithEpisodes = Show & { episodes: Episode[] }

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-3)', researching: 'var(--accent-violet)', focusing: 'var(--accent-cyan)',
  questions: 'var(--accent-cyan)', intro: 'var(--accent-pink)', script: 'var(--accent-pink)',
  video: 'var(--warning)', review: 'var(--warning)', approved: 'var(--success)', published: '#30d158',
}

type Tab = 'all' | 'production' | 'published' | 'promote' | 'approvals'

export function ShowDetailClient({
  show,
  currentEmail,
}: {
  show: ShowWithEpisodes
  currentEmail: string
}) {
  const router = useRouter()
  const t = useT()
  const [episodes, setEpisodes] = useState(show.episodes)
  const [tab, setTab] = useState<Tab>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [chatEp, setChatEp] = useState<Episode | null>(null)

  const production = episodes.filter((e) => e.status !== 'published')
  const published = episodes.filter((e) => e.status === 'published')
  const promote = episodes.filter((e) => ['approved', 'published'].includes(e.status))
  const approvals = episodes.filter((e) => e.status === 'review' && !e.managerApproved)

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'all', label: t('shows.tabAll') },
    { key: 'production', label: t('shows.tabProduction') },
    { key: 'published', label: t('shows.tabPublished') },
    { key: 'promote', label: t('shows.tabPromote') },
    { key: 'approvals', label: t('shows.tabApprovals'), badge: approvals.length },
  ]

  async function approve(id: string) {
    setEpisodes((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'approved', managerApproved: true } : e))
    )
    try {
      await fetch(`/api/episodes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', managerApproved: true }),
      })
      toast.success(t('shows.approvedToast'))
    } catch {
      toast.error(t('shows.approveError'))
    }
  }

  const list =
    tab === 'all'
      ? episodes
      : tab === 'production'
        ? production
        : tab === 'published'
          ? published
          : tab === 'promote'
            ? promote
            : approvals

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/shows')} className="text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]">
          <ArrowLeft size={18} />
        </button>
        <p className="body-sm text-[var(--ink-3)]">{t('nav.shows')}</p>
      </div>

      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 shrink-0 rounded-[var(--radius-md)]"
              style={{
                background: show.coverImageUrl ? undefined : 'var(--bg-3)',
                backgroundImage: show.coverImageUrl ? `url(${show.coverImageUrl})` : undefined,
                backgroundSize: 'cover',
              }}
            />
            <div>
              <h1 className="display-sm text-[var(--ink-1)]">{show.name}</h1>
              {show.description && <p className="body mt-1 text-[var(--ink-2)]">{show.description}</p>}
              <span
                className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                style={{ background: 'rgba(48,209,88,0.1)', color: 'var(--success)' }}
              >
                <Crown size={12} /> {t('shows.youAreManager')}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <PillButton variant="secondary" size="sm" onClick={() => router.push('/guests')}>
              <Users size={14} /> {t('shows.addGuest')}
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={() => router.push(`/shows/${show.id}/dna`)}>
              <Dna size={14} /> {t('shows.podcastDna')}
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Settings size={14} /> {t('common.edit')}
            </PillButton>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 overflow-x-auto rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={cn(
                'body-sm flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition-all',
                tab === tabItem.key ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
              )}
            >
              {tabItem.label}
              {tabItem.badge ? (
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold"
                  style={{ background: 'var(--warning)', color: 'var(--bg-0)' }}
                >
                  {tabItem.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <Link
          href="/calendar"
          className="body-sm rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
          style={{ borderColor: 'var(--line-2)' }}
        >
          {t('nav.calendar')}
        </Link>
      </div>

      {/* Content */}
      {list.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="body text-[var(--ink-2)]">{t('shows.nothingHere')}</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {list.map((ep) => (
            <GlassCard key={ep.id} className="flex items-center justify-between gap-3 p-4">
              <Link href={`/episodes/${ep.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--bg-3)' }}
                >
                  {(ep.coverImageUrl ?? ep.guestPhotoUrl) ? (
                    <img src={ep.coverImageUrl ?? ep.guestPhotoUrl ?? ''} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="body-sm font-bold text-[var(--ink-4)]">{ep.guestName.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="body truncate font-medium text-[var(--ink-1)]">{ep.title ?? ep.guestName}</p>
                  <p className="body-sm text-[var(--ink-3)]">
                    {ep.guestName}
                    {ep.releaseDate && ` · ${t('shows.airs')} ${formatDate(ep.releaseDate)}`}
                  </p>
                </span>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                {tab === 'promote' ? (
                  ep.socialContent ? (
                    <Link
                      href={`/episodes/${ep.id}`}
                      className="body-sm flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold"
                      style={{ background: 'rgba(48,209,88,0.12)', color: 'var(--success)' }}
                    >
                      <Check size={13} /> {t('shows.viewContent')}
                    </Link>
                  ) : (
                    <Link
                      href={`/episodes/${ep.id}`}
                      className="body-sm flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold"
                      style={{ background: 'rgba(255,159,10,0.14)', color: '#ff9f0a' }}
                    >
                      <Sparkles size={13} /> {t('shows.generate')}
                    </Link>
                  )
                ) : tab === 'approvals' ? (
                  <PillButton size="sm" onClick={() => approve(ep.id)}>
                    <Check size={14} /> {t('shows.approve')}
                  </PillButton>
                ) : (
                  <span
                    className="body-sm rounded-full px-2.5 py-0.5 font-semibold capitalize"
                    style={{ background: `${STATUS_COLOR[ep.status] ?? 'var(--ink-4)'}18`, color: STATUS_COLOR[ep.status] ?? 'var(--ink-4)' }}
                  >
                    {t(`status.${ep.status}`)}
                  </span>
                )}
                <button
                  onClick={() => setChatEp(ep)}
                  className="rounded-full p-2 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
                  aria-label={t('shows.episodeChatAria')}
                >
                  <MessageSquare size={16} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <EditShowModal open={editOpen} onOpenChange={setEditOpen} show={show} onSaved={() => window.location.reload()} />
      {chatEp && (
        <EpisodeChatPanel
          episodeId={chatEp.id}
          episodeTitle={chatEp.title ?? chatEp.guestName}
          currentEmail={currentEmail}
          onClose={() => setChatEp(null)}
        />
      )}
    </div>
  )
}

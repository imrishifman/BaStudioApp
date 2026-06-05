'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Mic, Sparkles } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { ShowCard } from '@/components/shows/ShowCard'
import { EditShowModal } from '@/components/shows/EditShowModal'
import { GuestsClient } from '@/app/(app)/guests/guests-client'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n/I18nProvider'
import type { Show, Guest } from '@prisma/client'

type ShowWithEpisodes = Show & { episodes: { status: string }[] }

interface Props {
  shows: ShowWithEpisodes[]
  guests: Guest[]
}

export function ShowsClient({ shows, guests }: Props) {
  const router = useRouter()
  const t = useT()
  const [tab, setTab] = useState<'shows' | 'guests'>('shows')
  const [createOpen, setCreateOpen] = useState(false)
  // After creating a show we open a "what's next?" prompt. Many users were
  // stopping after the show step and never producing an episode, so the episode
  // CTA is the primary action; setting Show DNA stays available as a secondary
  // option and "Maybe later" closes the modal.
  const [postCreateShow, setPostCreateShow] = useState<Show | null>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
        >
          {(['shows', 'guests'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'body-sm rounded-full px-4 py-1.5 font-semibold capitalize transition-all',
                tab === tabKey ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]'
              )}
            >
              {tabKey === 'shows' ? t('shows.tabShows') : t('shows.tabGuests')}
            </button>
          ))}
        </div>
        {tab === 'shows' && (
          <PillButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> {t('shows.newShow')}
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
            <p className="display-sm text-[var(--ink-1)]">{t('shows.createFirstTitle')}</p>
            <p className="body text-[var(--ink-2)]">
              {t('shows.createFirstBody')}
            </p>
            <PillButton onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> {t('shows.createFirstCta')}
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
        onCreated={(show) => setPostCreateShow(show)}
      />

      {/* Post-create nudge: primary CTA pushes the user into the episode wizard
          so the show → first-episode funnel doesn't leak. The DNA path stays
          available as a secondary option. Closing the modal (X or "Maybe later")
          reloads so the new show card appears in the list. */}
      <Dialog
        open={!!postCreateShow}
        onOpenChange={(v) => { if (!v) { setPostCreateShow(null); window.location.reload() } }}
      >
        <DialogContent className="max-w-md border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
          <DialogHeader>
            <div
              className="mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent-violet) 18%, transparent)' }}
            >
              <Sparkles size={22} style={{ color: 'var(--accent-violet)' }} />
            </div>
            <DialogTitle className="display-sm text-[var(--ink-1)]">
              {t('shows.afterCreateTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="body text-[var(--ink-2)]">{t('shows.afterCreateBody')}</p>
          <div className="flex flex-col gap-2 pt-2">
            <PillButton
              onClick={() => {
                const id = postCreateShow?.id
                setPostCreateShow(null)
                // Pass the just-created show id so the wizard can preselect it
                // (and harmlessly ignored if it doesn't).
                router.push(id ? `/episodes/new?showId=${id}` : '/episodes/new')
              }}
            >
              <Plus size={14} /> {t('shows.createFirstEpisodeCta')}
            </PillButton>
            <PillButton
              variant="secondary"
              onClick={() => {
                const id = postCreateShow?.id
                setPostCreateShow(null)
                if (id) router.push(`/shows/${id}/dna`)
              }}
            >
              <Sparkles size={14} /> {t('shows.setShowDnaCta')}
            </PillButton>
            <button
              type="button"
              onClick={() => { setPostCreateShow(null); window.location.reload() }}
              className="body-sm py-1 text-[var(--ink-3)] hover:text-[var(--ink-2)]"
            >
              {t('shows.maybeLater')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

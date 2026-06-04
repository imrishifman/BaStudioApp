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
  // After creating a show we invite the user to set its Show DNA right away.
  const [dnaPromptShow, setDnaPromptShow] = useState<Show | null>(null)

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
        onCreated={(show) => setDnaPromptShow(show)}
      />

      {/* Post-create nudge: set the Show DNA now or later. */}
      <Dialog open={!!dnaPromptShow} onOpenChange={(v) => { if (!v) { setDnaPromptShow(null); window.location.reload() } }}>
        <DialogContent className="max-w-md border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
          <DialogHeader>
            <div
              className="mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent-violet) 18%, transparent)' }}
            >
              <Sparkles size={22} style={{ color: 'var(--accent-violet)' }} />
            </div>
            <DialogTitle className="display-sm text-[var(--ink-1)]">{t('shows.dnaPromptTitle')}</DialogTitle>
          </DialogHeader>
          <p className="body text-[var(--ink-2)]">
            {t('shows.dnaPromptBodyP1')} <span className="font-semibold text-[var(--ink-1)]">{t('shows.dnaPromptGood')}</span> {t('shows.dnaPromptBodyP2')} <span className="font-semibold text-[var(--ink-1)]">{t('shows.dnaPromptProfessional')}</span>{t('shows.dnaPromptBodyP3')}
          </p>
          <div className="flex gap-3 pt-2">
            <PillButton
              onClick={() => {
                const id = dnaPromptShow?.id
                setDnaPromptShow(null)
                if (id) router.push(`/shows/${id}/dna`)
              }}
            >
              <Sparkles size={14} /> {t('shows.setItUpNow')}
            </PillButton>
            <PillButton
              variant="secondary"
              onClick={() => { setDnaPromptShow(null); window.location.reload() }}
            >
              {t('shows.maybeLater')}
            </PillButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { useI18n } from '@/components/i18n/I18nProvider'

// Shown by /episodes/new INSTEAD of the wizard when the user has already
// created their plan's monthly quota of episodes. The limit is communicated
// the moment they click "+ New Episode", not later when research fails.
export function EpisodeLimitScreen({ cap }: { cap: number }) {
  const { lang, t } = useI18n()
  const router = useRouter()

  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(
    lang === 'he' ? 'he-IL' : 'en-US',
    { month: 'long', day: 'numeric' },
  )

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center p-6">
      <GlassCard className="flex w-full flex-col items-center gap-4 p-10 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--accent-violet) 18%, transparent)' }}
        >
          <Sparkles size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <h1 className="display-sm text-[var(--ink-1)]">{t('episode.creationLimitTitle')}</h1>
        <p className="body text-[var(--ink-2)]">
          {t('episode.creationLimitBody1')}{cap}
          {cap === 1 ? t('episode.creationLimitBody2One') : t('episode.creationLimitBody2Many')}
          {resetDate}
          {t('episode.creationLimitBody3')}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <PillButton onClick={() => router.push('/pricing')}>
            {t('episode.creationLimitCta')} <ArrowRight size={14} />
          </PillButton>
          <PillButton variant="secondary" onClick={() => router.push('/studio')}>
            {t('episode.creationLimitBack')}
          </PillButton>
        </div>
      </GlassCard>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Episode } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'
import { normalizeGenerated } from '@/lib/questions'
import { episodesThisMonth, maxEpisodesPerMonth } from '@/lib/plan-gating'
import { pushEvent } from '@/lib/gtm'

type Tier = 'free' | 'pro_trial' | 'pro'

// How many questions ended up on the episode (best-effort across shapes).
function countQuestions(ep: Episode | null): number {
  const g = ep?.generatedQuestions
  if (Array.isArray(g)) return g.length
  try {
    const { map } = normalizeGenerated(g)
    return Object.values(map).flat().length
  } catch {
    return 0
  }
}

// Whole minutes since the episode was created, floored at 1 (never "0 min").
function elapsedMinutes(ep: Episode | null): number {
  if (!ep?.createdAt) return 1
  const ms = Date.now() - new Date(ep.createdAt).getTime()
  return Math.max(1, Math.round(ms / 60000))
}

// Celebratory bookend shown once the full script is generated. Peak delight, so
// we surface a contextual upgrade nudge here (additive, never blocks Continue).
export function EpisodeReadyOverlay({ episode, onContinue }: { episode: Episode | null; onContinue: () => void }) {
  const t = useT()
  const router = useRouter()
  const { data: session } = useSession()
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null)
  const [atCap, setAtCap] = useState(false)
  const [busy, setBusy] = useState(false)
  const trackedRef = useRef(false)

  const questions = countQuestions(episode)
  const minutes = elapsedMinutes(episode)

  // Tier from the session (trial-aware): isTrialActive distinguishes a Pro
  // trial from a real paid solo plan.
  const plan = session?.user?.plan
  const tier: Tier = session?.user?.isTrialActive
    ? 'pro_trial'
    : plan === 'free'
      ? 'free'
      : 'pro'
  const trialEndsAt = session?.user?.trialEndsAt
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0

  useEffect(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 140, spread: 78, origin: { y: 0.45 }, colors: ['#2dd4bf', '#67e8f9', '#a78bfa', '#fba5c9'] })
    })
  }, [])

  // Compute episode number + cap status, then fire the view event once.
  useEffect(() => {
    const email = session?.user?.email
    if (!email || trackedRef.current) return
    ;(async () => {
      let number = 1
      try {
        const res = await fetch('/api/episodes')
        if (res.ok) {
          const list = (await res.json()) as { createdByEmail: string; createdAt: string }[]
          const used = episodesThisMonth(
            list.map((e) => ({ ...e, createdAt: new Date(e.createdAt) })),
            email,
          ).length
          number = Math.max(1, used)
          setAtCap(used >= maxEpisodesPerMonth('free'))
        }
      } catch {
        /* best-effort; default to episode 1, not at cap */
      }
      setEpisodeNumber(number)
      if (!trackedRef.current) {
        trackedRef.current = true
        pushEvent('episode_ready_viewed', { tier, episodeNumber: number, elapsedMinutes: minutes })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email])

  async function upgrade() {
    pushEvent('episode_ready_upgrade_clicked')
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'solo',
          period: 'monthly',
          returnTo: episode?.id ? `/episodes/${episode.id}` : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url; return }
      toast.error(data.error ?? 'Could not start checkout')
      setBusy(false)
    } catch { toast.error('Network error. Please try again.'); setBusy(false) }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-6"
      style={{ background: 'var(--bg-0)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-label={t('episode.readyAria')}
    >
      {/* Stats line: amplify the wow before the orb. */}
      <p className="body-sm text-center text-[var(--ink-3)]">
        ✓ Full guest brief&nbsp;&nbsp; ✓ {questions} questions written&nbsp;&nbsp; ✓ Complete script&nbsp;&nbsp; ✓ Ready in {minutes} min
      </p>

      <div className="ai-orb" style={{ animation: 'ai-orb-complete 0.6s ease-out' }} />
      <div className="text-center">
        <h2 className="display-sm text-[var(--ink-1)]">{t('episode.readyTitle')}</h2>
        <p className="body mt-2 max-w-sm text-[var(--ink-2)]">{t('episode.readyBody')}</p>
      </div>

      <PillButton onClick={onContinue}>
        {t('episode.continue')} <ArrowRight size={14} />
      </PillButton>

      {/* Contextual CTA card. Rendered only once episodeNumber is known so the
          free branch picks the right copy. Hidden entirely for paid Pro users. */}
      {episodeNumber !== null && tier !== 'pro' && (
        <CtaCard
          tier={tier}
          atCap={atCap}
          trialDaysLeft={trialDaysLeft}
          busy={busy}
          onUpgrade={upgrade}
          onSeePlans={() => router.push('/pricing')}
        />
      )}
    </motion.div>
  )
}

function CtaCard({
  tier, atCap, trialDaysLeft, busy, onUpgrade, onSeePlans,
}: {
  tier: Tier
  atCap: boolean
  trialDaysLeft: number
  busy: boolean
  onUpgrade: () => void
  onSeePlans: () => void
}) {
  const cardStyle = { background: 'var(--bg-2)', border: '1px solid var(--line-1)' }

  if (tier === 'pro_trial') {
    return (
      <div className="max-w-sm rounded-2xl p-4 text-center" style={cardStyle}>
        <p className="body-sm text-[var(--ink-2)]">
          🎉 You&apos;re on your Pro trial, download your script and send it to your guest in the
          next steps. <span className="font-semibold text-[var(--ink-1)]">{trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left</span>
        </p>
      </div>
    )
  }

  // tier === 'free'
  if (atCap) {
    return (
      <div className="max-w-sm rounded-2xl p-4 text-center" style={cardStyle}>
        <p className="body-sm text-[var(--ink-2)]">
          💎 Love it? You&apos;ve used your free episode. Upgrade to Pro for unlimited episodes,
          downloads, and guest sharing, $19.99/mo
        </p>
        <PillButton onClick={onUpgrade} disabled={busy} className="mt-3 w-full justify-center">
          {busy ? 'Opening checkout...' : 'Upgrade to Pro'}
        </PillButton>
      </div>
    )
  }

  // Free with episodes left: soft, curiosity-only prompt.
  return (
    <div className="max-w-sm rounded-2xl p-4 text-center" style={cardStyle}>
      <p className="body-sm text-[var(--ink-2)]">
        This took 90 seconds. Imagine an entire season.{' '}
        <button onClick={onSeePlans} className="font-semibold text-[var(--accent-violet)] hover:underline">
          See Pro plans →
        </button>
      </p>
    </div>
  )
}

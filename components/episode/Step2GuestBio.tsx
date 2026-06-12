'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, ArrowRight, RefreshCw, Telescope, UserX, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { useAILoading } from './AILoadingContext'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { SmartTextarea } from './SmartTextarea'
import { postAI } from '@/lib/ai-client'
import { useT } from '@/components/i18n/I18nProvider'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  onGoToStep?: (step: number) => void
  onEpisodeChange?: (ep: Episode) => void
  userEmail: string
}

export function Step2GuestBio({ episode, onNext, onGoToStep, onEpisodeChange }: Props) {
  const t = useT()
  const router = useRouter()
  const { runAI } = useAILoading()
  const confirm = useConfirm()
  const [bio, setBio] = useState(episode?.guestBio ?? '')
  const [research, setResearch] = useState(episode?.guestResearch ?? '')
  const [funFacts, setFunFacts] = useState<string[]>((episode?.funFacts as string[]) ?? [])
  // True when the guest has a very small public footprint, so we show an honest
  // "limited info, add sources" note above the (still editable) result.
  const [thin, setThin] = useState(false)
  // True when research was blocked by the plan's monthly research limit, so we
  // show a clear upgrade note instead of the misleading "not enough sources" card.
  const [limitReached, setLimitReached] = useState(false)
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [showResearch, setShowResearch] = useState(false)
  // Deep research is a one-time pass.
  const [deepDone, setDeepDone] = useState(() => (episode?.guestResearch ?? '').includes('Deep research'))

  useEffect(() => {
    if (!episode?.id || episode.guestResearch) return
    runResearch('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id])

  async function runResearch(mode: 'initial' | 'deep') {
    if (!episode?.id) return
    setLoading(true)
    setLimitReached(false)
    try {
      // Split into two phases so each Vercel function call fits in 60s:
      //   1) research (web search) → saves guestResearch
      //   2) derive  (bio + facts in parallel from saved research)
      // Plus a best-effort intro draft on the initial pass.
      const data = await runAI('research', async (signal) => {
        const r = await postAI<{ research?: string }>('/api/ai/research', {
          episodeId: episode.id,
          guestName: episode.guestName,
          mode,
          phase: 'research',
        }, signal)
        const d = await postAI<{ bio?: string; funFacts?: string[]; thin?: boolean }>('/api/ai/research', {
          episodeId: episode.id,
          guestName: episode.guestName,
          mode,
          phase: 'derive',
        }, signal)
        if (mode === 'initial' && !episode.introductionScript) {
          try {
            await postAI('/api/ai/script', { episodeId: episode.id, showId: episode.showId, kind: 'intro', setStatus: false }, signal)
          } catch { /* bonus */ }
        }
        return { ...r, ...d }
      })
      setBio(data.bio ?? bio)
      setResearch(data.research ?? research)
      if (data.funFacts) setFunFacts(data.funFacts)
      setThin(!!data.thin)
      if (mode === 'deep') setDeepDone(true)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      // The monthly research limit returns 403 with a "limit reached" message.
      // Show a dedicated upgrade card rather than a misleading "no results" state.
      const status = (err as { status?: number })?.status
      const msg = err instanceof Error ? err.message : ''
      if (status === 403 || /limit/i.test(msg)) {
        setLimitReached(true)
      } else {
        toast.error(msg || t('episode.researchFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function regenerateBio() {
    if (!episode?.id) return
    setRegenLoading(true)
    try {
      const data = await postAI<{ bio?: string }>('/api/ai/research', {
        episodeId: episode.id,
        guestName: episode.guestName,
        mode: 'regenerate-bio',
      })
      if (data.bio) setBio(data.bio)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('episode.couldNotRegenerate'))
    } finally {
      setRegenLoading(false)
    }
  }

  async function handleNext() {
    await onNext({ guestBio: bio, guestResearch: research, status: 'focusing' })
  }

  // "Wrong person?" — the research found the wrong individual. Clear the research
  // so it regenerates, then send the user back to Step 1 to add sharper sources
  // (LinkedIn, website, context) that disambiguate the right person.
  async function wrongPerson() {
    const ok = await confirm({
      title: t('episode.wrongPerson'),
      message: t('episode.wrongPersonMsg'),
      confirmLabel: t('episode.addMoreSources'),
    })
    if (!ok) return
    if (episode?.id) {
      try {
        const res = await fetch(`/api/episodes/${episode.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestBio: null,
            guestResearch: null,
            funFacts: [],
            introductionScript: null,
            status: 'researching',
          }),
        })
        if (res.ok) onEpisodeChange?.(await res.json())
      } catch {
        /* navigate anyway; Step 1 still has the name + links */
      }
    }
    onGoToStep?.(1)
  }

  // Did the research actually turn anything up? If not, we show a friendly
  // "need more sources" state instead of an empty editor (the reported bug).
  const hasResults = !!(bio.trim() || research.trim() || funFacts.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">{t('episode.stepPrefix')}2{t('episode.of10')}</p>
        <h2 className="display-sm text-[var(--ink-1)]">{t('episode.s2Title')}</h2>
        <p className="body mt-1 text-[var(--ink-2)]">{t('episode.s2Body')}</p>
      </div>

      {loading ? (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">{t('episode.researchingPrefix')}{episode?.guestName}{t('episode.ellipsis')}</p>
        </GlassCard>
      ) : limitReached ? (
        // The plan's monthly research limit was hit. Show a clear upgrade prompt
        // rather than letting the research silently fail (which read like a bug).
        <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
          <Sparkles size={30} className="text-[var(--accent-violet)]" />
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">{t('episode.researchLimitTitle')}</p>
            <p className="body-sm mt-1 text-[var(--ink-2)]">{t('episode.researchLimitBody')}</p>
          </div>
          <PillButton onClick={() => router.push('/pricing')}>
            {t('episode.researchLimitCta')} <ArrowRight size={14} />
          </PillButton>
        </GlassCard>
      ) : !hasResults ? (
        // No usable research came back — almost always too few sources to pin
        // down the right person. Send them back to Step 1 to add more.
        <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
          <SearchX size={32} className="text-[var(--ink-3)]" />
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">{t('episode.notEnoughPrefix')}{episode?.guestName || t('episode.thisGuest')}</p>
            <p className="body-sm mt-1 text-[var(--ink-2)]">
              {t('episode.notEnoughBody')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onGoToStep && (
              <PillButton onClick={() => onGoToStep(1)}>
                {t('episode.addMoreSources')}
              </PillButton>
            )}
            <PillButton variant="secondary" onClick={() => runResearch('initial')}>
              <RefreshCw size={14} /> {t('episode.tryAgain')}
            </PillButton>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {thin && (
            // Honest low-confidence note: we found little public info, so the
            // result leans on the host's own context. Nudge them to add sources.
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.25)' }}
            >
              <SearchX size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
              <p className="body-sm text-[var(--ink-2)]">
                {t('episode.thinResultsNote')}
                {onGoToStep && (
                  <>
                    {' '}
                    <button onClick={() => onGoToStep(1)} className="font-semibold text-[var(--ink-1)] underline">
                      {t('episode.addMoreSources')}
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="body-sm text-[var(--ink-2)]">{t('episode.quickBio')}</label>
              <button onClick={regenerateBio} disabled={regenLoading} className="body-sm flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink-1)] disabled:opacity-50">
                <RefreshCw size={12} className={regenLoading ? 'animate-spin' : ''} /> {t('episode.regenerate')}
              </button>
            </div>
            <SmartTextarea value={bio} onChange={setBio} rows={3} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
          </div>

          {funFacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="body-sm text-[var(--ink-2)]">{t('episode.funFacts')}</label>
              <GlassCard className="space-y-1.5 p-4">
                {funFacts.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[var(--accent-violet)]">•</span>
                    <p className="body-sm text-[var(--ink-2)]">{f}</p>
                  </div>
                ))}
              </GlassCard>
            </div>
          )}

          <div>
            <button onClick={() => setShowResearch(s => !s)} className="body-sm text-[var(--ink-3)] underline hover:text-[var(--ink-1)]">
              {showResearch ? t('episode.hideFullResearch') : t('episode.showFullResearch')}
            </button>
            {showResearch && (
              <div className="mt-2">
                <SmartTextarea value={research} onChange={setResearch} rows={10} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <PillButton variant="secondary" size="sm" onClick={() => runResearch('deep')} disabled={deepDone}>
              <Telescope size={14} /> {deepDone ? t('episode.deepResearchDone') : t('episode.deepResearch')}
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={wrongPerson}>
              <UserX size={14} /> {t('episode.wrongPerson')}
            </PillButton>
          </div>
        </div>
      )}

      {!loading && hasResults && (
        <PillButton onClick={handleNext} disabled={!bio}>
          {t('episode.next')} <ArrowRight size={14} />
        </PillButton>
      )}
    </div>
  )
}

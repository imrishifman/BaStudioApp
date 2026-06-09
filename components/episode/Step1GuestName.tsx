'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PillButton } from '@/components/common/PillButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, ArrowRight, Play, X } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'
import { OnboardingVideoModal } from '@/components/onboarding/OnboardingVideoModal'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch: Partial<Episode>) => Promise<void>
  onEpisodeCreated: (ep: Episode) => void
  userEmail: string
  seenWizardIntro?: boolean
}

export function Step1GuestName({ episode, show, shows, onNext, onEpisodeCreated, userEmail, seenWizardIntro = false }: Props) {
  const t = useT()
  const [guestName, setGuestName] = useState(episode?.guestName ?? '')
  // "First time? Rewatch demo" strip. Persists dismissal to /api/me so future
  // visits never show it again. Local state makes the dismiss feel instant.
  const [introStripVisible, setIntroStripVisible] = useState(!seenWizardIntro)
  const [introModalOpen, setIntroModalOpen] = useState(false)

  function dismissIntroStrip() {
    setIntroStripVisible(false)
    // Fire-and-forget. If the network call fails the strip will reappear on
    // the next visit, which is acceptable.
    void fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seenWizardIntro: true }),
    })
  }
  const [showId, setShowId] = useState(episode?.showId ?? shows[0]?.id ?? '')
  const [guestLinkedinUrl, setLinkedin] = useState(episode?.guestLinkedinUrl ?? '')
  const [guestTwitterUrl, setTwitter] = useState(episode?.guestTwitterUrl ?? '')
  const [guestInstagramUrl, setInstagram] = useState(episode?.guestInstagramUrl ?? '')
  const [guestWebsiteUrl, setWebsite] = useState(episode?.guestWebsiteUrl ?? '')
  const [guestExtraContext, setExtra] = useState(episode?.guestExtraContext ?? '')
  const [loading, setLoading] = useState(false)

  const hasFocus = !!(
    guestLinkedinUrl.trim() ||
    guestTwitterUrl.trim() ||
    guestInstagramUrl.trim() ||
    guestWebsiteUrl.trim() ||
    guestExtraContext.trim()
  )

  async function handleResearch() {
    if (!guestName.trim()) { toast.error(t('episode.enterNameFirst')); return }
    if (!hasFocus) { toast.error(t('episode.addSourceFocus')); return }
    setLoading(true)
    try {
      // Pressing "Research Guest" always starts a fresh scan. Clear any prior
      // research-derived fields so Step 2 re-runs against the CURRENT name and
      // sources, e.g. when the user came back here and changed the guest name.
      const patch: Partial<Episode> = {
        guestName, showId: showId || undefined,
        guestLinkedinUrl: guestLinkedinUrl || undefined,
        guestTwitterUrl: guestTwitterUrl || undefined,
        guestInstagramUrl: guestInstagramUrl || undefined,
        guestWebsiteUrl: guestWebsiteUrl || undefined,
        guestExtraContext: guestExtraContext || undefined,
        guestBio: null,
        guestResearch: null,
        funFacts: [],
        introductionScript: null,
        status: 'researching',
      }
      await onNext(patch)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* First-time onboarding strip. A quiet offer, not a billboard. Persists
          dismissal so it never reappears. */}
      {introStripVisible && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
        >
          <button
            type="button"
            onClick={() => setIntroModalOpen(true)}
            className="body-sm flex items-center gap-2 text-[var(--ink-2)] hover:text-[var(--ink-1)]"
          >
            <span className="font-semibold text-[var(--ink-1)]">First time?</span>
            <Play size={12} className="text-[var(--accent-violet)]" />
            <span>Rewatch the demo</span>
          </button>
          <button
            type="button"
            onClick={dismissIntroStrip}
            aria-label="Dismiss"
            className="rounded-full p-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <OnboardingVideoModal open={introModalOpen} onOpenChange={setIntroModalOpen} />

      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">{t('episode.stepPrefix')}1{t('episode.of10')}</p>
        <h2 className="display-sm text-[var(--ink-1)]">{t('episode.s1Title')}</h2>
        <p className="body mt-1 text-[var(--ink-2)]">
          {t('episode.s1Body')}
        </p>
      </div>

      <div className="space-y-4">
        {shows.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="body-sm text-[var(--ink-2)]">{t('episode.showOptional')}</Label>
            <Select value={showId} onValueChange={setShowId}>
              <SelectTrigger className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)]">
                <SelectValue placeholder={t('episode.selectShow')} />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg-2)] border-[var(--line-1)]">
                {shows.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-[var(--ink-1)]">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="body-sm text-[var(--ink-2)]">{t('episode.guestNameLabel')}</Label>
          <Input
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder={t('episode.guestNamePh')}
            className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)] text-lg"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="body-sm text-[var(--ink-2)]">{t('episode.socialLinks')}</Label>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'rgba(167,139,250,0.14)', color: 'var(--accent-violet)' }}
          >
            {t('episode.recommended')}
          </span>
          <span className="body-sm text-[var(--ink-4)]">{t('episode.moreSourcesHint')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={guestLinkedinUrl} onChange={e => setLinkedin(e.target.value)} placeholder={t('episode.phLinkedin')} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestTwitterUrl} onChange={e => setTwitter(e.target.value)} placeholder={t('episode.phTwitter')} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestInstagramUrl} onChange={e => setInstagram(e.target.value)} placeholder={t('episode.phInstagram')} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
          <Input value={guestWebsiteUrl} onChange={e => setWebsite(e.target.value)} placeholder={t('episode.phWebsite')} className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="body-sm text-[var(--ink-2)]">{t('episode.extraContext')}</Label>
          <Textarea
            value={guestExtraContext}
            onChange={e => setExtra(e.target.value)}
            placeholder={t('episode.extraContextPh')}
            rows={3}
            className="bg-[var(--bg-2)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <PillButton onClick={handleResearch} disabled={loading || !guestName.trim() || !hasFocus} size="lg">
          {loading ? t('episode.researching') : <><Sparkles size={16} /> {t('episode.researchGuest')}</>}
        </PillButton>
        {guestName.trim() && !hasFocus && (
          <p className="body-sm text-[var(--ink-3)]">
            {t('episode.s1FocusHint')}
          </p>
        )}
      </div>
    </div>
  )
}

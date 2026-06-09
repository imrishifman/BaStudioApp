'use client'

import { useEffect, useRef, useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { ImageUpload } from '@/components/common/ImageUpload'
import { Input } from '@/components/ui/input'
import { ArrowRight, Mail, Copy, CheckCheck, Lock, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'
import { UpgradeModal } from '@/components/common/UpgradeModal'
import { isPaidPlan } from '@/lib/plan-access'
import { trackPaywallViewed, type PaywallGate } from '@/lib/gtm'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
  userPlan?: string
}

export function Step9Share({ episode, onNext, userPlan = 'free' }: Props) {
  const t = useT()
  const canShare = isPaidPlan(userPlan)
  const briefUrl = episode?.briefUrl ?? (episode?.id ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/brief/${episode.id}` : '')
  const [guestEmail, setGuestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(episode?.coverImageUrl ?? null)
  const [upgradeGate, setUpgradeGate] = useState<PaywallGate | null>(null)
  const returnTo = episode?.id ? `/episodes/${episode.id}` : undefined

  // A free user sees three gates on this screen. Fire paywall_viewed once each.
  const viewedRef = useRef(false)
  useEffect(() => {
    if (canShare || viewedRef.current) return
    viewedRef.current = true
    trackPaywallViewed('share_link')
    trackPaywallViewed('share_email')
    trackPaywallViewed('episode_image')
  }, [canShare])

  async function copyLink() {
    await navigator.clipboard.writeText(briefUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendEmail() {
    if (!guestEmail || !episode?.id) return
    setSending(true)
    try {
      const res = await fetch('/api/email/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeId: episode.id, guestEmail }) })
      if (res.ok) { toast.success(t('episode.briefSent')); setGuestEmail('') }
      else if (res.status === 402) { setUpgradeGate('share_email') }
      else toast.error(t('episode.failedToSend'))
    } catch { toast.error(t('episode.failedToSend')) } finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <UpgradeModal
        open={upgradeGate !== null}
        onOpenChange={(o) => { if (!o) setUpgradeGate(null) }}
        gate={upgradeGate ?? 'share_link'}
        returnTo={returnTo}
      />

      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">{t('episode.stepPrefix')}9{t('episode.of10')}</p>
        <h2 className="display-sm text-[var(--ink-1)]">{t('episode.s9Title')}</h2>
        <p className="body mt-1 text-[var(--ink-2)]">{t('episode.s9Body')}</p>
      </div>

      {/* Episode picture: free users get a locked placeholder. */}
      <GlassCard className="p-6">
        {canShare ? (
          <ImageUpload
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            label={t('episode.episodePicture')}
            hint={t('episode.episodePictureHint')}
          />
        ) : (
          <LockedRow
            icon={<ImageIcon size={16} />}
            label={t('episode.episodePicture')}
            text="Upgrade to add episode artwork"
            onUpgrade={() => setUpgradeGate('episode_image')}
          />
        )}
      </GlassCard>

      <GlassCard className="p-6 space-y-4">
        {/* Guest brief link */}
        <div>
          <p className="body-sm mb-2 text-[var(--ink-2)]">{t('episode.guestBriefLink')}</p>
          {canShare ? (
            <div className="flex gap-2">
              <Input value={briefUrl} readOnly className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1 font-mono text-sm" />
              <PillButton variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              </PillButton>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2 select-none" style={{ filter: 'blur(5px)' }} aria-hidden>
                <Input value={briefUrl || 'https://bastudiopodcast.com/brief/preview'} readOnly className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1 font-mono text-sm" />
                <PillButton variant="secondary" size="sm" disabled><Copy size={14} /></PillButton>
              </div>
              <UpgradeOverlay
                text="Upgrade to unlock shareable guest brief"
                onUpgrade={() => setUpgradeGate('share_link')}
              />
            </div>
          )}
        </div>

        <div className="hairline" />

        {/* Send via email */}
        <div>
          <p className="body-sm mb-2 text-[var(--ink-2)]">{t('episode.sendViaEmail')}</p>
          {canShare ? (
            <div className="flex gap-2">
              <Input
                type="email"
                value={guestEmail}
                onChange={e => setGuestEmail(e.target.value)}
                placeholder="guest@example.com"
                className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1 placeholder:text-[var(--ink-4)]"
                onKeyDown={e => e.key === 'Enter' && sendEmail()}
              />
              <PillButton size="sm" onClick={sendEmail} disabled={sending || !guestEmail}>
                <Mail size={14} /> {sending ? t('episode.sending') : t('episode.send')}
              </PillButton>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2 select-none" style={{ filter: 'blur(5px)' }} aria-hidden>
                <Input type="email" value="" placeholder="guest@example.com" readOnly className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1" />
                <PillButton size="sm" disabled><Mail size={14} /> {t('episode.send')}</PillButton>
              </div>
              <UpgradeOverlay
                text="Upgrade to email the brief to your guest"
                onUpgrade={() => setUpgradeGate('share_email')}
              />
            </div>
          )}
        </div>
      </GlassCard>

      <div className="flex gap-3">
        <PillButton onClick={() => onNext({ briefUrl, coverImageUrl: coverImageUrl ?? null, status: 'approved' })}>
          {t('episode.next')} <ArrowRight size={14} />
        </PillButton>
        <PillButton variant="secondary" onClick={() => onNext({ briefUrl, coverImageUrl: coverImageUrl ?? null })}>{t('episode.skip')}</PillButton>
      </div>
    </div>
  )
}

// Centered lock overlay laid over a blurred control.
function UpgradeOverlay({ text, onUpgrade }: { text: string; onUpgrade: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl text-center"
      style={{ background: 'color-mix(in srgb, var(--bg-2) 55%, transparent)' }}>
      <p className="body-sm flex items-center gap-1.5 font-semibold text-[var(--ink-1)]">
        <Lock size={13} /> {text}
      </p>
      <PillButton size="sm" onClick={onUpgrade}>Upgrade</PillButton>
    </div>
  )
}

// Locked row used in place of the image uploader for free users.
function LockedRow({ icon, label, text, onUpgrade }: { icon: React.ReactNode; label: string; text: string; onUpgrade: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ink-3)]" style={{ background: 'var(--bg-3)', border: '1px solid var(--line-1)' }}>
          {icon}
        </div>
        <div>
          <p className="body-sm font-semibold text-[var(--ink-1)]">{label}</p>
          <p className="body-sm flex items-center gap-1 text-[var(--ink-3)]"><Lock size={12} /> {text}</p>
        </div>
      </div>
      <PillButton size="sm" onClick={onUpgrade}>Upgrade</PillButton>
    </div>
  )
}

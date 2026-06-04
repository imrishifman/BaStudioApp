'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { ArrowRight, Upload, Video } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/components/i18n/I18nProvider'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

export function Step8Video({ episode, onNext }: Props) {
  const t = useT()
  const [videoUrl, setVideoUrl] = useState(episode?.introVideoUrl ?? '')
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, { method: 'POST', body: file })
      const data = await res.json()
      if (data.url) setVideoUrl(data.url)
      else toast.error(t('episode.uploadFailed'))
    } catch { toast.error(t('episode.uploadFailed')) } finally { setUploading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">{t('episode.videoEyebrow')}</p>
        <h2 className="display-sm text-[var(--ink-1)]">{t('episode.s8Title')}</h2>
        <p className="body mt-1 text-[var(--ink-2)]">{t('episode.s8Body')}</p>
      </div>

      {videoUrl ? (
        <GlassCard className="p-4">
          <video src={videoUrl} controls className="w-full rounded-[var(--radius-sm)]" />
          <button onClick={() => setVideoUrl('')} className="body-sm mt-2 text-[var(--ink-3)] hover:text-[var(--error)]">{t('episode.remove')}</button>
        </GlassCard>
      ) : (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Video size={36} className="text-[var(--ink-3)]" />
          <div>
            <p className="body text-[var(--ink-1)]">{t('episode.uploadIntroVideo')}</p>
            <p className="body-sm text-[var(--ink-3)]">{t('episode.videoFormats')}</p>
          </div>
          <label className="pill-secondary cursor-pointer">
            <Upload size={14} /> {uploading ? t('episode.uploading') : t('episode.chooseFile')}
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileChange} disabled={uploading} />
          </label>
        </GlassCard>
      )}

      <div className="flex gap-3">
        <PillButton onClick={() => onNext({ introVideoUrl: videoUrl || undefined })}>
          {t('episode.next')} <ArrowRight size={14} />
        </PillButton>
        <PillButton variant="secondary" onClick={() => onNext({})}>{t('episode.skip')}</PillButton>
      </div>
    </div>
  )
}

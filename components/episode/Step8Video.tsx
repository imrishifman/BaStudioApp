'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { ArrowRight, Upload, Video } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

export function Step8Video({ episode, onNext }: Props) {
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
      else toast.error('Upload failed')
    } catch { toast.error('Upload failed') } finally { setUploading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 8 - Optional</p>
        <h2 className="display-sm text-[var(--ink-1)]">Intro video</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Upload a short video intro for your episode page.</p>
      </div>

      {videoUrl ? (
        <GlassCard className="p-4">
          <video src={videoUrl} controls className="w-full rounded-[var(--radius-sm)]" />
          <button onClick={() => setVideoUrl('')} className="body-sm mt-2 text-[var(--ink-3)] hover:text-[var(--error)]">Remove</button>
        </GlassCard>
      ) : (
        <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
          <Video size={36} className="text-[var(--ink-3)]" />
          <div>
            <p className="body text-[var(--ink-1)]">Upload intro video</p>
            <p className="body-sm text-[var(--ink-3)]">MP4, MOV - max 100MB</p>
          </div>
          <label className="pill-secondary cursor-pointer">
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Choose file'}
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileChange} disabled={uploading} />
          </label>
        </GlassCard>
      )}

      <div className="flex gap-3">
        <PillButton onClick={() => onNext({ introVideoUrl: videoUrl || undefined })}>
          Next <ArrowRight size={14} />
        </PillButton>
        <PillButton variant="secondary" onClick={() => onNext({})}>Skip</PillButton>
      </div>
    </div>
  )
}

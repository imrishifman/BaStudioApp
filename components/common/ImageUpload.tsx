'use client'

import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  value: string | null | undefined
  onChange: (url: string | null) => void
  label?: string
  hint?: string
  /** Visual shape of the preview. 'square' for cover art, 'wide' for banners. */
  shape?: 'square' | 'wide'
}

const MAX_BYTES = 8 * 1024 * 1024 // 8MB

// Reusable cover-image picker. Uploads to /api/upload (Vercel Blob) and hands the
// public URL back via onChange. Used for both Show and Episode cover art.
export function ImageUpload({ value, onChange, label = 'Cover image', hint, shape = 'square' }: Props) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image is too large (max 8MB)')
      return
    }
    setUploading(true)
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
      })
      const data = await res.json()
      if (res.ok && data.url) onChange(data.url)
      else toast.error(data.error ?? 'Upload failed')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const boxCls = shape === 'wide' ? 'aspect-[16/9] w-full' : 'h-28 w-28'

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="body-sm text-[var(--ink-2)]">{label}</label>}
      <div className="flex items-center gap-3">
        {value ? (
          <div className={`relative overflow-hidden rounded-[var(--radius-sm)] border ${boxCls}`} style={{ borderColor: 'var(--line-2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Remove image"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed text-center transition-colors hover:border-[var(--accent-violet)] ${boxCls}`}
            style={{ borderColor: 'var(--line-2)', background: 'var(--bg-3)' }}
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-[var(--ink-3)]" />
            ) : (
              <ImagePlus size={20} className="text-[var(--ink-3)]" />
            )}
            <span className="body-sm px-2 text-[var(--ink-4)]">{uploading ? 'Uploading…' : 'Add image'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={uploading} />
          </label>
        )}
        {hint && <p className="body-sm max-w-[14rem] text-[var(--ink-4)]">{hint}</p>}
      </div>
    </div>
  )
}

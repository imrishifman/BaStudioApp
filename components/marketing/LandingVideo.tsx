'use client'

import { useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { pushEvent } from '@/lib/gtm'

// A self-contained demo video section that sits directly under "How it works"
// on the landing page. Self-hosted MP4 (Vercel CDN), autoplay + muted + loop,
// with a sound toggle. Fires play/complete analytics events.

const VIDEO_SRC = '/onboarding/how-to-create-episode.mp4'
const POSTER_SRC = '/onboarding/how-to-create-episode-poster.jpg'

export function LandingVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const playFired = useRef(false)
  const completeFired = useRef(false)

  function toggleSound() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted) v.play().catch(() => {})
  }
  function onPlay() {
    if (playFired.current) return
    playFired.current = true
    pushEvent('demo_video_played')
  }
  function onTimeUpdate() {
    const v = videoRef.current
    if (!v || !v.duration || completeFired.current) return
    if (v.currentTime / v.duration > 0.9) {
      completeFired.current = true
      pushEvent('demo_video_completed')
    }
  }

  return (
    <section className="px-5 py-20 sm:px-8" style={{ background: 'var(--bg-0)' }}>
      <div className="mx-auto max-w-[1000px] text-center">
        <h2 className="display-md mb-3 text-[var(--ink-1)]">Watch it happen, in 90 seconds.</h2>
        <p className="body mx-auto mb-9 max-w-[52ch] text-[var(--ink-2)]">
          Turn a guest&apos;s name into a full, ready-to-record episode: research, questions, and a script.
        </p>
        <div
          className="relative mx-auto overflow-hidden rounded-2xl shadow-2xl"
          style={{ aspectRatio: '16 / 9', border: '1px solid var(--line-1)', background: 'var(--bg-2)' }}
        >
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onPlay={onPlay}
            onTimeUpdate={onTimeUpdate}
            className="h-full w-full object-cover"
          />
          <button
            onClick={toggleSound}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-105"
            style={{ background: 'color-mix(in srgb, var(--bg-0) 60%, transparent)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>
    </section>
  )
}

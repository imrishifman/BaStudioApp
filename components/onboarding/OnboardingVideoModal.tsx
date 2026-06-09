'use client'

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

// Shared modal that plays the onboarding video. Used by the wizard Step 1 strip
// (SECONDARY) and the "?" icon in the top nav (TERTIARY). One component, one
// asset, one source of truth.
//
// Open/close is controlled. We deliberately do NOT autoplay here: the user
// just clicked an explicit "play" affordance, so loading and starting
// playback on mount is the expected behaviour. We DO mute by default so the
// browser allows autoplay-on-open, then the user can unmute via controls.

const VIDEO_SRC = '/onboarding/how-to-create-episode.mp4'
const POSTER_SRC = '/onboarding/how-to-create-episode-poster.jpg'

export function OnboardingVideoModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // When the modal closes, pause the video so audio doesn't keep playing
  // somewhere off-screen during the close animation.
  useEffect(() => {
    if (!open) videoRef.current?.pause()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-[var(--line-1)] p-0"
        style={{ background: 'var(--bg-2)' }}
      >
        {/* Accessible label, kept off-screen to avoid stealing space from the
            video itself. */}
        <DialogTitle className="sr-only">How to create an episode</DialogTitle>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ aspectRatio: '16 / 9', background: 'var(--bg-3)' }}
        >
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            loop={false}
            playsInline
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

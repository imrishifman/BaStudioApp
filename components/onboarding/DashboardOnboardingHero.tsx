'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { pushEvent } from '@/lib/gtm'

// First-run onboarding hero. Replaces the dashboard's empty state when the
// user has zero episodes. Disappears automatically the moment they create one
// (controlled by the caller's `episodes.length === 0` check).
//
// UX rules from spec:
//  - 16:9 video, autoplay muted (browsers allow that), playsInline, controls,
//    poster shown until playback starts. Captions burned in (no <track>).
//  - Loop OFF: it's a tutorial, not a hero animation.
//  - CTA visible without scrolling on 360x640 (the smallest typical mobile).
//
// Tracking (GTM dataLayer; integrated with the rest of the funnel):
//  - dashboard_video_played    -> once per session on first play
//  - dashboard_video_completed -> once, when watched past 90 %
//  - dashboard_cta_clicked     -> only counts when the video was played
//                                  first in the same session (attribution)

const VIDEO_SRC = '/onboarding/how-to-create-episode.mp4'
const POSTER_SRC = '/onboarding/how-to-create-episode-poster.jpg'

export function DashboardOnboardingHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasPlayed, setHasPlayed] = useState(false)
  const playFiredRef = useRef(false)
  const completedFiredRef = useRef(false)

  function handlePlay() {
    if (playFiredRef.current) return
    playFiredRef.current = true
    setHasPlayed(true)
    pushEvent('dashboard_video_played')
  }

  function handleTimeUpdate() {
    if (completedFiredRef.current) return
    const v = videoRef.current
    if (!v || !v.duration) return
    if (v.currentTime / v.duration > 0.9) {
      completedFiredRef.current = true
      pushEvent('dashboard_video_completed')
    }
  }

  function handleCtaClick() {
    if (hasPlayed) pushEvent('dashboard_cta_clicked')
  }

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="grid gap-6 p-6 md:grid-cols-2 md:items-center md:gap-10 md:p-10">
        {/* Video. Source is 1280x770 (~1.66:1); object-cover trims a hair so
            the rounded 16:9 frame is clean rather than letterboxed. */}
        <div
          className="overflow-hidden rounded-2xl"
          style={{ aspectRatio: '16 / 9', background: 'var(--bg-2)' }}
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
            onPlay={handlePlay}
            onTimeUpdate={handleTimeUpdate}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Headline + sub + CTA. Visible without scrolling on 360x640. */}
        <div className="flex flex-col gap-4">
          <h2 className="display-sm text-[var(--ink-1)]">
            Your first episode in 4 minutes.
          </h2>
          <p className="body text-[var(--ink-2)]">
            Type a guest&apos;s name, we do the rest.
          </p>
          <Link
            href="/episodes/new"
            onClick={handleCtaClick}
            className="pill-primary inline-flex w-full items-center justify-center gap-2 md:w-fit"
          >
            Create my first episode <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </GlassCard>
  )
}

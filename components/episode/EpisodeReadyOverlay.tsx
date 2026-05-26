'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { PillButton } from '@/components/common/PillButton'
import { ArrowRight } from 'lucide-react'

// Celebratory bookend shown once the full script is generated - mirrors the
// AI loading overlay's language (same orb), closing the loop on the journey.
export function EpisodeReadyOverlay({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    let cancelled = false
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return
      confetti({
        particleCount: 140,
        spread: 78,
        origin: { y: 0.45 },
        colors: ['#2dd4bf', '#67e8f9', '#a78bfa', '#fba5c9'],
      })
    })
    return () => { cancelled = true }
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-7 px-6"
      style={{ background: 'var(--bg-0)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-label="Episode ready"
    >
      <div className="ai-orb" style={{ animation: 'ai-orb-complete 0.6s ease-out' }} />
      <div className="text-center">
        <h2 className="display-sm text-[var(--ink-1)]">Your episode is ready</h2>
        <p className="body mt-2 max-w-sm text-[var(--ink-2)]">
          Research, questions, intro, and script - all done. Take it from here.
        </p>
      </div>
      <PillButton onClick={onContinue}>
        Continue <ArrowRight size={14} />
      </PillButton>
    </motion.div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useTransform, useScroll } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { EyebrowTag } from '@/components/common/EyebrowTag'

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const textY = useTransform(scrollY, [0, 600], [0, -60])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <section
      ref={containerRef}
      className="relative z-[2] flex min-h-screen flex-col items-center justify-center overflow-hidden pt-14"
    >
      {/* Ambient background. Transparent base so the shared traveling mic
          (rendered behind this section) shows through. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(167,139,250,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Text content */}
      <motion.div
        style={{ y: textY, opacity, padding: '0 clamp(20px, 5vw, 80px)' }}
        className="relative z-10 mx-auto flex max-w-[1240px] flex-col items-center text-center"
      >
        <EyebrowTag dot className="mb-8">
          Ba Studio
        </EyebrowTag>

        <h1
          className="display-xl text-gradient mb-6"
          style={{ maxWidth: '16ch' }}
        >
          Create podcasts at the speed of AI
        </h1>

        <p
          className="body-lg mb-10 text-[var(--ink-2)]"
          style={{ maxWidth: '46ch' }}
        >
          From the first idea to the final cut, in one studio that learns how
          you sound.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/?signin=1" className="pill-primary pill-primary-lg">
            Try Ba Studio
          </Link>
        </div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-8 flex flex-col items-center gap-2"
        animate={{ y: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
      >
        <p className="eyebrow text-[var(--ink-3)]">Scroll to see the path</p>
        <ChevronDown size={14} className="text-[var(--ink-3)]" />
      </motion.div>
    </section>
  )
}

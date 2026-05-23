'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const STATS = [
  { number: '4,200+', label: 'Episodes produced' },
  { number: '98%', label: 'Guest satisfaction' },
  { number: '3×', label: 'Faster prep time' },
  { number: '140+', label: 'Active studios' },
  { number: '12min', label: 'Avg. script time' },
]

export function Numbers() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20%' })

  return (
    <section
      ref={ref}
      className="relative mx-auto max-w-[1240px]"
      style={{ padding: '0 clamp(20px, 5vw, 80px) clamp(96px, 12vw, 200px)' }}
    >
      <div className="hairline mb-16" />

      <div className="grid grid-cols-2 gap-px md:grid-cols-5" style={{ background: 'var(--line-1)' }}>
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.8,
              delay: i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex flex-col items-center gap-2 p-8 text-center"
            style={{ background: 'var(--bg-0)' }}
          >
            <p
              className="display-md font-bold text-[var(--ink-1)]"
              style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'clamp(32px, 4vw, 52px)' }}
            >
              {stat.number}
            </p>
            <p className="body-sm text-[var(--ink-3)]">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="hairline mt-16" />
    </section>
  )
}

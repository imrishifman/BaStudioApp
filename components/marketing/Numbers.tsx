'use client'

import { motion } from 'framer-motion'

const STATS = [
  { number: '4,200+', label: 'Episodes produced' },
  { number: '98%', label: 'Guest satisfaction' },
  { number: '3×', label: 'Faster prep time' },
  { number: '140+', label: 'Active studios' },
  { number: '12min', label: 'Avg. script time' },
]

export function Numbers() {
  // Duplicate the list so the marquee can loop seamlessly.
  const items = [...STATS, ...STATS]

  return (
    <section
      className="relative"
      style={{ padding: '0 0 clamp(96px, 12vw, 200px)' }}
    >
      <div
        className="mx-auto max-w-[1240px]"
        style={{ paddingInline: 'clamp(20px, 5vw, 80px)' }}
      >
        <div className="hairline mb-12" />
      </div>

      {/* Moving line of numbers (same on mobile) */}
      <div className="relative overflow-hidden">
        {/* Edge fades */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 md:w-32"
          style={{ background: 'linear-gradient(to right, var(--bg-0), transparent)' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 md:w-32"
          style={{ background: 'linear-gradient(to left, var(--bg-0), transparent)' }}
        />

        <motion.div
          className="flex w-max items-baseline gap-10 md:gap-16"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        >
          {items.map((stat, i) => (
            <div key={i} className="flex items-baseline gap-3 whitespace-nowrap">
              <span
                className="font-bold text-[var(--ink-1)]"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'clamp(28px, 4vw, 48px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {stat.number}
              </span>
              <span className="body-sm text-[var(--ink-3)]">{stat.label}</span>
              <span
                className="ml-7 inline-block h-1.5 w-1.5 shrink-0 rounded-full md:ml-10"
                style={{ background: 'var(--accent-violet)' }}
                aria-hidden
              />
            </div>
          ))}
        </motion.div>
      </div>

      <div
        className="mx-auto max-w-[1240px]"
        style={{ paddingInline: 'clamp(20px, 5vw, 80px)' }}
      >
        <div className="hairline mt-12" />
      </div>
    </section>
  )
}

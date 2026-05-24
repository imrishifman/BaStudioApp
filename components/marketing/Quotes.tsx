'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Quote } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'

const QUOTES = [
  {
    quote:
      'Ba Studio cut my episode prep from four hours to forty minutes. The guest research alone is worth the subscription.',
    name: 'Juniper Vale',
    role: 'Host, The Signal Room',
  },
  {
    quote:
      'My questions used to feel recycled. Now every episode has a fresh angle. I trust the research completely.',
    name: 'Caspian Holt',
    role: 'Founder & Host, Orbit Sessions',
  },
  {
    quote:
      'The DNA system understands my voice. The scripts sound like me on a very good day, not like a robot.',
    name: 'Marlowe Quinn',
    role: 'Host, Nightfall Radio',
  },
]

export function Quotes() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })

  return (
    <section
      ref={ref}
      id="customers"
      className="mx-auto max-w-[1240px] scroll-mt-20"
      style={{ padding: '0 clamp(20px, 5vw, 80px) clamp(96px, 12vw, 200px)' }}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {QUOTES.map((q, i) => (
          <motion.div
            key={q.name}
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard className="flex h-full flex-col gap-6 p-8">
              <Quote
                size={20}
                className="shrink-0"
                style={{ color: 'var(--accent-violet)' }}
                aria-hidden
              />
              <p
                className="flex-1 leading-[1.35] text-[var(--ink-1)]"
                style={{ fontSize: 'clamp(16px, 1.6vw, 22px)', fontWeight: 500 }}
              >
                {q.quote}
              </p>
              <div>
                <p className="body-sm font-semibold text-[var(--ink-1)]">{q.name}</p>
                <p className="body-sm text-[var(--ink-3)]">{q.role}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { EyebrowTag } from '@/components/common/EyebrowTag'
import { cn } from '@/lib/utils'

const TABS = ['Structure', 'Tone', 'Signature', 'AI Brief'] as const
type Tab = (typeof TABS)[number]

const SECTIONS_DATA: Record<Tab, { label: string; duration: string }[]> = {
  Structure: [
    { label: 'Cold Open', duration: '2 min' },
    { label: 'Guest Intro', duration: '3 min' },
    { label: 'Origin Story', duration: '8 min' },
    { label: 'Core Insight', duration: '15 min' },
    { label: 'Rapid Fire', duration: '5 min' },
    { label: 'Close', duration: '2 min' },
  ],
  Tone: [
    { label: 'Interview Style', duration: 'Conversational' },
    { label: 'Host Energy', duration: 'Warm & Curious' },
    { label: 'Language Level', duration: 'Accessible' },
    { label: 'Humor Level', duration: 'Light' },
    { label: 'Pacing', duration: 'Balanced' },
  ],
  Signature: [
    { label: 'Opening Line', duration: 'Custom' },
    { label: 'Closing Question', duration: 'Always same' },
    { label: 'Recurring Segments', duration: '2 defined' },
    { label: 'Topics to Avoid', duration: '3 flagged' },
  ],
  'AI Brief': [
    { label: 'Research Instructions', duration: 'Custom' },
    { label: 'Question Instructions', duration: 'Custom' },
    { label: 'Script Instructions', duration: 'Custom' },
    { label: 'Social Instructions', duration: 'Custom' },
  ],
}

export function DNASection() {
  const [activeTab, setActiveTab] = useState<Tab>('Structure')
  const [paused, setPaused] = useState(false)

  // Auto-advance through the tabs every 2 seconds — stops once the user clicks.
  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      setActiveTab((current) => {
        const next = (TABS.indexOf(current) + 1) % TABS.length
        return TABS[next]
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [paused])

  return (
    <section
      className="mx-auto max-w-[1240px]"
      style={{ padding: '0 clamp(20px, 5vw, 80px) clamp(96px, 12vw, 200px)' }}
    >
      <div className="mb-16 max-w-xl">
        <EyebrowTag dot className="mb-4">
          Podcast DNA
        </EyebrowTag>
        <h2 className="display-lg text-gradient mb-4">
          Your show has a soul.
        </h2>
        <p className="body-lg text-[var(--ink-2)]">
          Define your structure, tone, and signature once. Every episode inherits
          it, refined over time until the AI sounds exactly like you.
        </p>
      </div>

      <GlassCard className="overflow-hidden">
        {/* Tabs */}
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--line-1)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setPaused(true)
              }}
              className={cn(
                'body-sm relative px-6 py-4 font-semibold transition-colors',
                activeTab === tab
                  ? 'text-[var(--ink-1)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="dna-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{ background: 'var(--accent-violet)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--line-1)' }}>
          {SECTIONS_DATA[activeTab].slice(0, 4).map((row, i) => (
            <motion.div
              key={row.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <GripVertical
                  size={14}
                  className="shrink-0 text-[var(--ink-4)]"
                  aria-hidden
                />
                <span className="body text-[var(--ink-1)]">{row.label}</span>
              </div>
              <span
                className="body-sm rounded-full px-3 py-1 text-[var(--ink-3)]"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--line-1)' }}
              >
                {row.duration}
              </span>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </section>
  )
}

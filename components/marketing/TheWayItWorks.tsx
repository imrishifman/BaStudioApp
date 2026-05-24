'use client'

import { useRef, useState } from 'react'
import {
  useScroll,
  useTransform,
  motion,
  AnimatePresence,
  useMotionValueEvent,
  type MotionValue,
} from 'framer-motion'
import { EyebrowTag } from '@/components/common/EyebrowTag'

const CHAPTERS = [
  {
    step: '01',
    eyebrow: 'The Guest',
    heading: 'You type a name.\nWe bring back a person.',
    body: 'Our AI scours the web, LinkedIn, and past interviews to build a real portrait of your guest: their worldview, their stories, their unasked questions.',
  },
  {
    step: '02',
    eyebrow: 'The DNA',
    heading: 'Your show has a fingerprint.\nWe read it.',
    body: 'Podcast DNA captures your voice, your structure, your influences. Every episode breathes the same air as your best ones ever did.',
  },
  {
    step: '03',
    eyebrow: 'The Questions',
    heading: 'Never ask\nthe same thing twice.',
    body: "Ba Studio cross-references every episode you've ever made. If a question sounds familiar, it tells you, and suggests a sharper angle instead.",
  },
  {
    step: '04',
    eyebrow: 'The Script',
    heading: 'From research to script\nin a single take.',
    body: 'One studio. The whole journey. Guest research, questions, intro, and full script, built in minutes, sounding like you on your very best day.',
  },
]

export function TheWayItWorks() {
  const outerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  })

  // Which chapter is active (0–3)
  const chapterIndex = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [0, 1, 2, 3, 3])

  return (
    <div ref={outerRef} id="how-it-works" className="relative" style={{ height: '400vh' }}>
      {/* Sticky viewport */}
      <div
        className="sticky top-0 flex h-screen items-center overflow-hidden"
        style={{ background: 'var(--bg-0)' }}
      >
        <div
          className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-16 md:grid-cols-2"
          style={{ padding: '0 clamp(20px, 5vw, 80px)' }}
        >
          {/* Left — text column */}
          <div className="flex flex-col justify-center">
            <p className="eyebrow mb-10 text-[var(--ink-3)]">How it works</p>

            {CHAPTERS.map((ch, i) => (
              <ChapterRow
                key={ch.step}
                chapter={ch}
                index={i}
                chapterIndex={chapterIndex}
              />
            ))}
          </div>

          {/* Right — visual placeholder (WebGL state driven by scroll) */}
          <div className="hidden items-center justify-center md:flex">
            <motion.div
              className="relative flex h-[480px] w-[380px] items-center justify-center rounded-[var(--radius-xl)]"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}
            >
              {CHAPTERS.map((ch, i) => (
                <VisualPanel key={ch.step} chapter={ch} index={i} chapterIndex={chapterIndex} />
              ))}
            </motion.div>
          </div>
        </div>

        {/* Step progress bar */}
        <StepProgress scrollYProgress={scrollYProgress} />
      </div>
    </div>
  )
}

function ChapterRow({
  chapter,
  index,
  chapterIndex,
}: {
  chapter: (typeof CHAPTERS)[number]
  index: number
  chapterIndex: MotionValue<number>
}) {
  const isActive = useTransformActive(chapterIndex, index)

  return (
    <motion.div
      className="mb-10 cursor-pointer"
      animate={{ opacity: isActive ? 1 : 0.28 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-1 flex items-center gap-3">
        <span
          className="eyebrow"
          style={{ color: isActive ? 'var(--accent-violet)' : 'var(--ink-4)' }}
        >
          {chapter.step}
        </span>
        <EyebrowTag className={isActive ? 'text-[var(--ink-3)]' : 'text-[var(--ink-4)]'}>
          {chapter.eyebrow}
        </EyebrowTag>
      </div>
      <h3
        className="display-sm mb-2 whitespace-pre-line text-[var(--ink-1)]"
        style={{ fontSize: 'clamp(22px, 2.5vw, 34px)' }}
      >
        {chapter.heading}
      </h3>
      <p className="body text-[var(--ink-2)]" style={{ maxWidth: '40ch' }}>
        {chapter.body}
      </p>
    </motion.div>
  )
}

function VisualPanel({
  chapter,
  index,
  chapterIndex,
}: {
  chapter: (typeof CHAPTERS)[number]
  index: number
  chapterIndex: MotionValue<number>
}) {
  const isActive = useTransformActive(chapterIndex, index)

  const accentColors = [
    'var(--accent-violet)',
    'var(--accent-cyan)',
    'var(--accent-cyan)',
    'var(--accent-violet)',
  ]

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key={chapter.step}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10"
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold"
            style={{
              background: `${accentColors[index]}18`,
              color: accentColors[index],
              border: `1px solid ${accentColors[index]}40`,
            }}
          >
            {chapter.step}
          </div>
          <p
            className="text-center font-semibold text-[var(--ink-1)]"
            style={{ fontSize: 18, lineHeight: 1.4 }}
          >
            {chapter.eyebrow}
          </p>
          <p className="body-sm text-center text-[var(--ink-3)]" style={{ maxWidth: '28ch' }}>
            {chapter.body}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StepProgress({
  scrollYProgress,
}: {
  scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress']
}) {
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-px"
      style={{ background: 'var(--line-1)' }}
    >
      <motion.div className="h-full" style={{ width, background: 'var(--accent-violet)' }} />
    </div>
  )
}

function useTransformActive(
  motionValue: MotionValue<number>,
  target: number
) {
  const rounded = useTransform(motionValue, (v) => Math.round(v))
  const [active, setActive] = useState(target === 0)
  useMotionValueEvent(rounded, 'change', (v: number) => setActive(v === target))
  return active
}

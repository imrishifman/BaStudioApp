'use client'

import { useRef } from 'react'
import {
  useScroll,
  useTransform,
  motion,
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

const ACCENTS = ['var(--accent-violet)', 'var(--accent-cyan)', 'var(--accent-cyan)', 'var(--accent-violet)']

// Filmstrip travel distance (px) and badge parallax lead. TRAVEL is large
// enough that an off-center step is fully pushed out of the clipped viewport
// by the time its neighbour is centered (no faint text ghosting at the edges).
const TRAVEL = 1760
const BADGE_LEAD = 300
// Steps complete their scroll by this fraction; the remainder is the mic's exit.
const SPREAD = 0.88

export function TheWayItWorks() {
  const outerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  })

  // Thin progress bar that fills as you move through the section.
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <div ref={outerRef} id="how-it-works" className="relative z-[2]" style={{ height: '300vh' }}>
      {/* Sticky viewport. Transparent so the shared traveling mic shows through
          and docks in the right column. */}
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div
          className="relative z-10 mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-16 md:grid-cols-2"
          style={{ padding: '0 clamp(20px, 5vw, 80px)' }}
        >
          {/* Left - chapters move continuously with scroll (a filmstrip). */}
          <div className="relative flex h-[70vh] flex-col justify-center">
            <h2 className="display-lg text-gradient absolute left-0 top-0">How it works</h2>

            {/* Vertical progress rail */}
            <div
              className="absolute left-0 top-16 hidden h-[calc(100%-8rem)] w-px md:block"
              style={{ background: 'var(--line-1)' }}
            >
              <motion.div
                className="absolute left-0 top-0 w-px origin-top"
                style={{
                  height: '100%',
                  scaleY: railScale,
                  background: 'linear-gradient(var(--accent-violet), var(--accent-cyan))',
                }}
              />
            </div>

            <div className="relative h-full overflow-hidden">
              {CHAPTERS.map((ch, i) => (
                <ChapterPanel
                  key={ch.step}
                  chapter={ch}
                  index={i}
                  scrollYProgress={scrollYProgress}
                />
              ))}
            </div>
          </div>

          {/* Right - the shared traveling mic docks here (rendered behind). */}
          <div className="hidden md:block" />
        </div>
      </div>
    </div>
  )
}

function ChapterPanel({
  chapter,
  index,
  scrollYProgress,
}: {
  chapter: (typeof CHAPTERS)[number]
  index: number
  scrollYProgress: MotionValue<number>
}) {
  // A continuous filmstrip: each chapter sits a fixed distance apart and the
  // whole strip slides up at a constant rate, so the steps are ALWAYS moving
  // with the scroll rather than snapping or resting in place. Chapter `index`
  // is centered exactly when scroll progress === a.
  // NOTE: useScroll accelerates these via a ScrollTimeline, so the input
  // breakpoints become WAAPI keyframe offsets and MUST stay within [0,1] and be
  // strictly increasing.
  const N = CHAPTERS.length
  // Steps finish their journey by SPREAD, leaving the final stretch for the
  // traveling mic to fly out off the right of the section.
  const a = (index / (N - 1)) * SPREAD
  const first = index === 0
  const last = index === N - 1

  // y = TRAVEL * (a - progress): centered at progress=a, gliding up otherwise.
  const y = useTransform(scrollYProgress, [0, 1], [a * TRAVEL, (a - 1) * TRAVEL])
  // Number badge drifts faster for a touch of parallax depth.
  const badgeY = useTransform(scrollYProgress, [0, 1], [a * BADGE_LEAD, (a - 1) * BADGE_LEAD])

  // Fade in/out around the centered moment. First holds in from the start, last
  // holds in and stays to the end so there's never a blank frame at the edges.
  const W = 0.16
  const opStops = first
    ? [0, W]
    : last
      ? [a - W, a]
      : [a - W, a, a + W]
  const opValues = first ? [1, 0] : last ? [0, 1] : [0, 1, 0]
  const opacity = useTransform(scrollYProgress, opStops, opValues)

  return (
    <div className="absolute inset-0 flex items-center md:pl-20">
      <motion.div className="w-full" style={{ y, opacity }}>
        <div className="mb-3 flex items-center gap-3">
          <motion.span
            className="display-sm font-bold"
            style={{ y: badgeY, color: ACCENTS[index], fontSize: 'clamp(40px, 5vw, 64px)', lineHeight: 1 }}
          >
            {chapter.step}
          </motion.span>
          <EyebrowTag className="text-[var(--ink-3)]">{chapter.eyebrow}</EyebrowTag>
        </div>
        <h3
          className="display-sm mb-3 whitespace-pre-line text-[var(--ink-1)]"
          style={{ fontSize: 'clamp(26px, 3vw, 42px)' }}
        >
          {chapter.heading}
        </h3>
        <p className="body text-[var(--ink-2)]" style={{ maxWidth: '42ch' }}>
          {chapter.body}
        </p>
      </motion.div>
    </div>
  )
}

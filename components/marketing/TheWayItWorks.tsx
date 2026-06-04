'use client'

import { useRef, useState, useEffect } from 'react'
import {
  useScroll,
  useTransform,
  useMotionTemplate,
  motion,
  type MotionValue,
} from 'framer-motion'
import { EyebrowTag } from '@/components/common/EyebrowTag'

// Mobile-only flag. On phones the title and the steps share one column, so we
// add breathing room under the title and blur step text as it rises behind it.
function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

const CHAPTERS = [
  {
    step: '01',
    eyebrow: 'The Guest',
    heading: 'You type a name. We bring back a person.',
    body: 'Our AI scours the web, LinkedIn, and past interviews to build a real portrait of your guest: their worldview, their stories, their unasked questions.',
  },
  {
    step: '02',
    eyebrow: 'The DNA',
    heading: 'Your show has a fingerprint. We read it.',
    body: 'Podcast DNA captures your voice, your structure, your influences. Every episode breathes the same air as your best ones ever did.',
  },
  {
    step: '03',
    eyebrow: 'The Questions',
    heading: 'Never ask the same thing twice.',
    body: "Ba Studio cross-references every episode you've ever made. If a question sounds familiar, it tells you, and suggests a sharper angle instead.",
  },
  {
    step: '04',
    eyebrow: 'The Script',
    heading: 'From research to script in a single take.',
    body: 'One studio. The whole journey. Guest research, questions, intro, and full script, built in minutes, sounding like you on your very best day.',
  },
]

const ACCENTS = ['var(--accent-violet)', 'var(--accent-cyan)', 'var(--accent-cyan)', 'var(--accent-violet)']

// Filmstrip travel distance (px) and badge parallax lead. TRAVEL is large
// enough that an off-center step is fully pushed out of the clipped viewport
// by the time its neighbour is centered (no faint text ghosting at the edges).
const TRAVEL = 1760
const BADGE_LEAD = 300
// The last step is centered at this fraction of scroll, leaving room (1 - SPREAD)
// for it to fade out symmetrically just like steps 1-3 (its fade-out window is
// [SPREAD - W, SPREAD, SPREAD + W], so SPREAD + W must stay <= 1). 0.82 keeps a
// small safety margin below 1.0 and removes the old empty "hold" tail before
// "Your show has a soul", so the two sections sit closer together.
const SPREAD = 0.82

export function TheWayItWorks() {
  const outerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ['start start', 'end end'],
  })

  // Thin progress bar that fills as you move through the section.
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <div ref={outerRef} id="how-it-works" className="relative z-[2]" style={{ height: '250vh' }}>
      {/* Sticky viewport. Transparent so the shared traveling mic shows through
          and docks in the right column. */}
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div
          className="relative z-10 mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-16 md:grid-cols-2"
          style={{ padding: '0 clamp(20px, 5vw, 80px)' }}
        >
          {/* Left - chapters move continuously with scroll (a filmstrip). */}
          <div className="relative flex h-[70vh] flex-col justify-center">
            <h2 className="display-lg text-gradient absolute left-0 top-0 z-20 whitespace-nowrap">How it works</h2>

            {/* Vertical progress rail. Starts just below the title (clamp matches
                the display-lg line height: 0.95 * 6vw) so it's one clean,
                continuous line beginning under "How it works" rather than cutting
                through the middle of the letters. */}
            <div
              className="absolute left-0 top-[clamp(52px,5.7vw,92px)] hidden h-[calc(100%-4rem-clamp(52px,5.7vw,92px))] w-px md:block"
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

  // y = TRAVEL * (a - progress): centered at progress=a, gliding up otherwise.
  const y = useTransform(scrollYProgress, [0, 1], [a * TRAVEL, (a - 1) * TRAVEL])
  // Number badge drifts faster for a touch of parallax depth.
  const badgeY = useTransform(scrollYProgress, [0, 1], [a * BADGE_LEAD, (a - 1) * BADGE_LEAD])

  // Fade in/out around the centered moment. First holds in from the start; every
  // other step (including the last) fades in, peaks at center, then fades out at
  // the same rise distance, so step 4 disappears exactly like steps 1-3. SPREAD
  // is chosen so the last step's a + W stays within [0, 1].
  const W = 0.16
  const opStops = first ? [0, W] : [a - W, a, a + W]
  const opValues = first ? [1, 0] : [0, 1, 0]
  const opacity = useTransform(scrollYProgress, opStops, opValues)

  // Mobile only: as a step rises above its centered position (y goes negative)
  // it slides up behind the "How it works" title. Blur it progressively so the
  // title stays clean and the overlap reads as an intentional soft wash rather
  // than two sets of crisp text colliding. No blur while at/below center.
  const isMobile = useIsMobile()
  const blurPx = useTransform(y, [-220, -40, 0], [9, 0, 0])
  const blurFilter = useMotionTemplate`blur(${blurPx}px)`

  return (
    // Push the step block down so the number isn't crowding the title. Phones get
    // a tighter gap; desktop gets a roomier one (the title has space to breathe).
    <div className="absolute inset-0 flex items-center pt-[13vh] md:pt-[16vh] md:pl-20">
      <motion.div
        className="w-full"
        style={{ y, opacity, ...(isMobile ? { filter: blurFilter } : {}) }}
      >
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
          className="display-sm mb-3 text-[var(--ink-1)] xl:whitespace-nowrap xl:text-[20px]!"
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

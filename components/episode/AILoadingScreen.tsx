'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export type AIStep = 'research' | 'focus' | 'questions' | 'intro' | 'script'

// All step categories currently share the same rotating messages.
const MESSAGES: string[] = [
  "Scanning your guest's latest work and ideas",
  'Weaving your podcast DNA into every question',
  'Reading between the lines of their story',
  'Searching for the angle no one else has asked',
  'Mapping the arc of a great conversation',
  'Listening to how your best episodes sound',
  'Pulling threads from interviews across the web',
  'Finding the moments worth leaning into',
  'Shaping questions that earn real answers',
  "Studying your guest's turning points",
  'Tuning every line to your voice',
  'Hunting for the surprising detail',
  'Connecting their past projects to your theme',
  'Drafting an opening that hooks from line one',
  'Balancing depth with easy curiosity',
  'Cross-referencing your back catalogue',
  'Sketching the shape of the episode',
  'Looking for the question they have never been asked',
  'Distilling hours of research into minutes',
  "Matching your show's rhythm and pacing",
  'Polishing the phrasing until it sounds like you',
  'Tracing the story only this guest can tell',
  'Gathering the facts that spark good follow-ups',
  'Aligning every beat with your focus',
  'Finding warmth without losing the edge',
  'Building momentum into the conversation',
  'Surfacing the ideas worth a deeper dive',
  'Translating research into real talking points',
  'Keeping it human, keeping it sharp',
  'Checking nothing important slips through',
  'Calibrating tone to your audience',
  'Drawing out the throughline of their work',
  'Writing for the ear, not the page',
  'Looking for the unexpected connection',
  'Setting up the questions that open people up',
  'Honoring your structure, section by section',
  'Pulling the quotes that reveal character',
  'Refining the flow from open to close',
  'Adding texture without adding fluff',
  'Making sure every question pays off',
  'Letting your podcast DNA lead the way',
  'Spotting the angle your listeners will love',
  'Turning a name into a real portrait',
  'Pressure-testing each line for substance',
  'Finding the spark that starts a great talk',
  'Smoothing the seams between sections',
  'Writing the version you would be proud to read',
  'Searching for the story behind the headlines',
  'Bringing it all together now',
  'Almost ready to hand it back to you',
]

interface Props {
  progress: number
  step: AIStep
  onCancel?: () => void
}

export function AILoadingScreen({ progress, onCancel }: Props) {
  const done = progress >= 100

  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * MESSAGES.length))
  const [msgVisible, setMsgVisible] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [barWidth, setBarWidth] = useState(0)
  const [gone, setGone] = useState(false)

  // Kick the slow 0 → 95% bar fill once mounted.
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarWidth(95))
    return () => cancelAnimationFrame(id)
  }, [])

  // Rotate messages every 3.5s with a fade-out → swap → fade-in.
  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length)
        setMsgVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(id)
  }, [done])

  // Elapsed timer drives the 45s "taking longer" message.
  useEffect(() => {
    if (done) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [done])

  // On completion, fade out then unmount.
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null

  const fillStyle: React.CSSProperties = done
    ? { width: '100%', transition: 'width 0.3s ease-out' }
    : { width: `${barWidth}%`, transition: 'width 20s cubic-bezier(0.12, 0.7, 0.05, 1)' }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-7 px-6 transition-opacity duration-500"
      style={{ background: 'var(--bg-0)', opacity: done ? 0 : 1 }}
      role="status"
      aria-live="polite"
    >
      <Image
        src="/logo.png"
        alt="Ba Studio"
        width={150}
        height={64}
        priority
        className="brand-logo h-8 w-auto"
      />

      <div className="ai-orb" style={done ? { animation: 'ai-orb-complete 0.45s ease-out forwards' } : undefined} />

      <div className="flex h-12 items-center">
        <p
          className="body-lg max-w-md text-center font-medium text-[var(--ink-1)] transition-opacity duration-300"
          style={{ opacity: msgVisible && !done ? 1 : 0 }}
        >
          {MESSAGES[msgIndex]}
        </p>
      </div>

      <p className="body-sm text-[var(--ink-3)]">This usually takes 10-30 seconds. Hang tight.</p>

      {elapsed >= 45 && !done && (
        <div className="flex flex-col items-center gap-2">
          <p className="body-sm text-[var(--ink-2)]">Taking a bit longer than usual… almost there.</p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="body-sm text-[var(--ink-3)] underline transition-colors hover:text-[var(--ink-1)]"
            >
              Cancel and try again
            </button>
          )}
        </div>
      )}

      {/* Neon progress bar */}
      <div className="absolute bottom-14 left-1/2 w-[min(520px,90vw)] -translate-x-1/2">
        <div className="ai-bar-track">
          <div className="ai-bar-fill" style={fillStyle}>
            <span className="ai-bar-orb" />
          </div>
        </div>
        <p className="ai-bar-label mt-3 text-center">{done ? 'READY' : 'LOADING……'}</p>
      </div>
    </div>
  )
}

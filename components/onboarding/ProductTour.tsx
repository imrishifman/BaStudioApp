'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Step {
  sel: string | null
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    sel: null,
    title: 'Welcome to Ba Studio 👋',
    body: "Quick tour — I'll point out the key buttons and what each one does.",
  },
  {
    sel: '[data-tour="new-episode"]',
    title: 'Create an episode',
    body: 'Start here. Add a guest and Ba Studio runs the research, questions, intro, and script.',
  },
  {
    sel: '[data-tour="/shows"]',
    title: 'Shows',
    body: 'Open a show to set its Podcast DNA, manage its Guests CRM, and its team.',
  },
  {
    sel: '[data-tour="/calendar"]',
    title: 'Calendar',
    body: 'Drag episodes onto dates to schedule releases, and mark when you and your team are available.',
  },
  {
    sel: '[data-tour="/team"]',
    title: 'Hub',
    body: 'Build teams, invite members, and chat with your crew (WhatsApp-style).',
  },
  {
    sel: '[data-tour="theme"]',
    title: 'Dark / Light',
    body: 'Switch the mood lighting whenever you like.',
  },
]

const TOOLTIP_W = 320

export function ProductTour() {
  const [seen, setSeen] = useState(true)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    try {
      setSeen(localStorage.getItem('ba-tour-seen') === '1')
    } catch {
      setSeen(false)
    }
  }, [])

  const measure = useCallback(() => {
    const s = STEPS[step]
    if (!s.sel) {
      setRect(null)
      return
    }
    const el = document.querySelector(s.sel)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setRect(el.getBoundingClientRect())
    } else {
      setRect(null)
    }
  }, [step])

  useEffect(() => {
    if (seen) return
    measure()
    const t = setTimeout(measure, 350) // after scroll settles
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [seen, measure])

  function finish() {
    try {
      localStorage.setItem('ba-tour-seen', '1')
    } catch {
      /* ignore */
    }
    setSeen(true)
  }

  if (seen) return null

  const last = step === STEPS.length - 1

  // Tooltip position
  let tip: React.CSSProperties
  if (rect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = rect.bottom + 12
    const placeAbove = below + 180 > vh
    const left = Math.min(Math.max(rect.left, 16), vw - TOOLTIP_W - 16)
    tip = placeAbove
      ? { left, bottom: vh - rect.top + 12, width: TOOLTIP_W }
      : { left, top: below, width: TOOLTIP_W }
  } else {
    tip = {
      left: '50%',
      top: '50%',
      width: Math.min(TOOLTIP_W, typeof window !== 'undefined' ? window.innerWidth - 32 : TOOLTIP_W),
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dim / spotlight */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[10px]"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)',
            border: '2px solid var(--accent-violet)',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.68)' }} />
      )}

      {/* Tooltip */}
      <div
        className="absolute rounded-[var(--radius-lg)] p-5 shadow-2xl"
        style={{ ...tip, background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === step ? 18 : 5, background: i <= step ? 'var(--accent-violet)' : 'var(--bg-3)' }}
              />
            ))}
          </div>
          <button onClick={finish} className="text-[var(--ink-4)] hover:text-[var(--ink-2)]" aria-label="Close tour">
            <X size={15} />
          </button>
        </div>

        <p className="body font-semibold text-[var(--ink-1)]">{STEPS[step].title}</p>
        <p className="body-sm mt-1 text-[var(--ink-2)]">{STEPS[step].body}</p>

        <div className="mt-4 flex items-center justify-between">
          <button onClick={finish} className="body-sm text-[var(--ink-4)] hover:text-[var(--ink-2)]">
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-semibold text-[var(--ink-2)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <ChevronLeft size={13} /> Back
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className="flex items-center gap-1 rounded-full px-4 py-1.5 text-[13px] font-semibold"
              style={{ background: 'var(--ink-1)', color: 'var(--bg-0)' }}
            >
              {last ? 'Done' : <>Next <ChevronRight size={13} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

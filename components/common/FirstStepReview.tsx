'use client'

import { useEffect, useState } from 'react'
import { Star, X, MessageSquare, Sparkles } from 'lucide-react'
import { PillButton } from '@/components/common/PillButton'
import { MILESTONE_COPY, type MilestoneKey } from '@/lib/milestones'

// Floating chat bubble that fires once per account when the user completes a
// milestone for the first time (first show, first DNA, first episode, first
// publish). Reuses the /api/feedback pipeline used by the Account review page.
// Marking "seen" happens on submit OR dismiss, so it never nags twice.
export function FirstStepReview({ pendingMilestone }: { pendingMilestone: MilestoneKey | null }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Gentle entrance: mount the bubble, then auto-expand after a beat so it
  // doesn't slam in front of the user the instant the page paints.
  useEffect(() => {
    if (!pendingMilestone) return
    setMounted(true)
    const t = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(t)
  }, [pendingMilestone])

  if (!pendingMilestone || dismissed) return null

  const copy = MILESTONE_COPY[pendingMilestone]

  async function markSeen() {
    try {
      await fetch('/api/milestones/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: pendingMilestone }),
      })
    } catch {
      // Best-effort: if it fails the prompt may re-appear next load, which is fine.
    }
  }

  async function dismiss() {
    setOpen(false)
    setDismissed(true)
    await markSeen()
  }

  async function submit() {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'review',
          rating,
          message,
          page: typeof window !== 'undefined' ? window.location.pathname : null,
          question: copy.prompt,
          source: 'milestone',
        }),
      })
      setSubmitted(true)
      await markSeen()
      // Let the thank-you breathe, then retire the bubble.
      setTimeout(() => {
        setOpen(false)
        setDismissed(true)
      }, 2200)
    } catch {
      // swallow — keep the bubble so the user can retry
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {/* Expanded panel */}
      {open && (
        <div
          className="pointer-events-auto w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl"
          style={{
            borderColor: 'var(--line-2)',
            background: 'var(--bg-1)',
            backdropFilter: 'blur(20px)',
            animation: 'fadeInUp 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: 'var(--line-1)', background: 'var(--bg-2)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}
              >
                <Sparkles size={15} style={{ color: 'var(--accent-violet)' }} />
              </span>
              <p className="body-sm font-semibold text-[var(--ink-1)]">{copy.title}</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-3 p-4">
            {submitted ? (
              <div className="space-y-2 py-4 text-center">
                <MessageSquare size={26} className="mx-auto text-[var(--accent-violet)]" />
                <p className="body font-semibold text-[var(--ink-1)]">Thank you</p>
                <p className="body-sm text-[var(--ink-3)]">We read every message — this shapes what we build next.</p>
              </div>
            ) : (
              <>
                <p className="body-sm text-[var(--ink-2)]">{copy.prompt}</p>

                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        size={22}
                        fill={n <= rating ? 'var(--warning)' : 'transparent'}
                        style={{ color: 'var(--warning)' }}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="What worked well, and what we could do better…"
                  className="w-full resize-none rounded-[var(--radius-sm)] border bg-[var(--bg-3)] p-2.5 body-sm text-[var(--ink-1)] placeholder:text-[var(--ink-4)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-violet)]"
                  style={{ borderColor: 'var(--line-2)' }}
                  maxLength={4000}
                />

                <div className="flex justify-end gap-2">
                  <PillButton variant="secondary" size="sm" onClick={dismiss}>
                    Not now
                  </PillButton>
                  <PillButton size="sm" onClick={submit} disabled={submitting || !message.trim()}>
                    {submitting ? 'Sending…' : 'Send'}
                  </PillButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Collapsed launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105"
          style={{ background: 'var(--accent-violet)' }}
          aria-label={copy.title}
        >
          <MessageSquare size={20} className="text-white" />
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, Heart, Lightbulb, AlertTriangle, MessageSquare } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'

type FeedbackType = 'praise' | 'review' | 'suggestion' | 'complaint'

const TYPES: { key: FeedbackType; label: string; icon: typeof Heart; color: string; description: string }[] = [
  { key: 'praise',     label: 'Praise',     icon: Heart,         color: 'var(--success)',       description: 'Something you loved' },
  { key: 'review',     label: 'Review',     icon: Star,          color: 'var(--warning)',       description: 'Overall experience' },
  { key: 'suggestion', label: 'Suggestion', icon: Lightbulb,     color: 'var(--accent-cyan)',   description: 'An idea or improvement' },
  { key: 'complaint',  label: 'Complaint',  icon: AlertTriangle, color: 'var(--error)',         description: 'Something that broke or frustrated you' },
]

export function ReviewClient({ userEmail }: { userEmail: string | null }) {
  const router = useRouter()
  const [type, setType] = useState<FeedbackType>('review')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!message.trim()) {
      toast.error('Please tell us a bit more')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, rating: type === 'review' ? rating : null, message, page: '/review' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit')
        return
      }
      setSubmitted(true)
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
        <GlassCard className="space-y-4 p-8 text-center">
          <MessageSquare size={32} className="mx-auto text-[var(--accent-violet)]" />
          <h1 className="display-sm text-[var(--ink-1)]">Thank you</h1>
          <p className="body text-[var(--ink-2)]">
            Your feedback went straight to the team. We read every message.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <PillButton variant="secondary" size="sm" onClick={() => { setSubmitted(false); setMessage(''); setRating(5); setType('review') }}>
              Submit another
            </PillButton>
            <PillButton size="sm" onClick={() => router.push('/studio')}>
              Back to studio
            </PillButton>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="display-sm text-[var(--ink-1)]">Tell us how it&apos;s going</h1>
        <p className="body mt-1 text-[var(--ink-2)]">
          Praise, complaints, ideas, anything. We read every message and it shapes what we build next.
        </p>
      </div>

      {/* Type picker */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPES.map((t) => {
          const Icon = t.icon
          const active = t.key === type
          return (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all"
              style={{
                borderColor: active ? t.color : 'var(--line-2)',
                background: active ? `${t.color}10` : 'var(--bg-2)',
              }}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${t.color}20` }}>
                <Icon size={16} style={{ color: t.color }} />
              </span>
              <div>
                <p className="body font-semibold text-[var(--ink-1)]">{t.label}</p>
                <p className="body-sm text-[var(--ink-3)]">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Star rating (only for reviews) */}
      {type === 'review' && (
        <GlassCard className="space-y-3 p-5">
          <p className="body-sm font-semibold text-[var(--ink-1)]">How would you rate your experience?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  fill={n <= rating ? 'var(--warning)' : 'transparent'}
                  style={{ color: 'var(--warning)' }}
                />
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Message */}
      <GlassCard className="space-y-3 p-5">
        <label className="body-sm font-semibold text-[var(--ink-1)]" htmlFor="feedback-message">
          Your message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={
            type === 'praise' ? 'What made you smile?' :
            type === 'review' ? 'Tell us about your overall experience…' :
            type === 'suggestion' ? 'What would make this better for you?' :
            'What broke or frustrated you?'
          }
          className="w-full resize-none rounded-[var(--radius-sm)] border bg-[var(--bg-3)] p-3 body text-[var(--ink-1)] placeholder:text-[var(--ink-4)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-violet)]"
          style={{ borderColor: 'var(--line-2)' }}
          maxLength={4000}
        />
        <div className="flex items-center justify-between">
          <p className="body-sm text-[var(--ink-4)]">{message.length} / 4000</p>
          {userEmail && <p className="body-sm text-[var(--ink-4)]">From {userEmail}</p>}
        </div>
      </GlassCard>

      <div className="flex justify-end gap-2">
        <PillButton variant="secondary" size="sm" onClick={() => router.push('/studio')}>
          Cancel
        </PillButton>
        <PillButton size="sm" onClick={submit} disabled={submitting || !message.trim()}>
          {submitting ? 'Sending…' : 'Send feedback'}
        </PillButton>
      </div>
    </div>
  )
}

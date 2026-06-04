'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, Heart, Lightbulb, AlertTriangle, MessageSquare } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { useT } from '@/components/i18n/I18nProvider'

type FeedbackType = 'praise' | 'review' | 'suggestion' | 'complaint'

const TYPES: { key: FeedbackType; labelKey: string; icon: typeof Heart; color: string; descKey: string }[] = [
  { key: 'praise',     labelKey: 'review.praiseLabel',     icon: Heart,         color: 'var(--success)',       descKey: 'review.praiseDesc' },
  { key: 'review',     labelKey: 'review.reviewLabel',     icon: Star,          color: 'var(--warning)',       descKey: 'review.reviewDesc' },
  { key: 'suggestion', labelKey: 'review.suggestionLabel', icon: Lightbulb,     color: 'var(--accent-cyan)',   descKey: 'review.suggestionDesc' },
  { key: 'complaint',  labelKey: 'review.complaintLabel',  icon: AlertTriangle, color: 'var(--error)',         descKey: 'review.complaintDesc' },
]

export function ReviewClient({ userEmail }: { userEmail: string | null }) {
  const tr = useT()
  const router = useRouter()
  const [type, setType] = useState<FeedbackType>('review')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    if (!message.trim()) {
      toast.error(tr('review.pleaseTellMore'))
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
        toast.error(data.error ?? tr('review.couldNotSubmit'))
        return
      }
      setSubmitted(true)
    } catch {
      toast.error(tr('review.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
        <GlassCard className="space-y-4 p-8 text-center">
          <MessageSquare size={32} className="mx-auto text-[var(--accent-violet)]" />
          <h1 className="display-sm text-[var(--ink-1)]">{tr('review.thankYou')}</h1>
          <p className="body text-[var(--ink-2)]">
            {tr('review.thankYouBody')}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <PillButton variant="secondary" size="sm" onClick={() => { setSubmitted(false); setMessage(''); setRating(5); setType('review') }}>
              {tr('review.submitAnother')}
            </PillButton>
            <PillButton size="sm" onClick={() => router.push('/studio')}>
              {tr('review.backToStudio')}
            </PillButton>
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="display-sm text-[var(--ink-1)]">{tr('review.title')}</h1>
        <p className="body mt-1 text-[var(--ink-2)]">
          {tr('review.subtitle')}
        </p>
      </div>

      {/* Type picker */}
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPES.map((item) => {
          const Icon = item.icon
          const active = item.key === type
          return (
            <button
              key={item.key}
              onClick={() => setType(item.key)}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-all"
              style={{
                borderColor: active ? item.color : 'var(--line-2)',
                background: active ? `${item.color}10` : 'var(--bg-2)',
              }}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${item.color}20` }}>
                <Icon size={16} style={{ color: item.color }} />
              </span>
              <div>
                <p className="body font-semibold text-[var(--ink-1)]">{tr(item.labelKey)}</p>
                <p className="body-sm text-[var(--ink-3)]">{tr(item.descKey)}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Star rating (only for reviews) */}
      {type === 'review' && (
        <GlassCard className="space-y-3 p-5">
          <p className="body-sm font-semibold text-[var(--ink-1)]">{tr('review.rateExperience')}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n} ${n > 1 ? tr('review.stars') : tr('review.star')}`}
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
          {tr('review.yourMessage')}
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={
            type === 'praise' ? tr('review.phPraise') :
            type === 'review' ? tr('review.phReview') :
            type === 'suggestion' ? tr('review.phSuggestion') :
            tr('review.phComplaint')
          }
          className="w-full resize-none rounded-[var(--radius-sm)] border bg-[var(--bg-3)] p-3 body text-[var(--ink-1)] placeholder:text-[var(--ink-4)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-violet)]"
          style={{ borderColor: 'var(--line-2)' }}
          maxLength={4000}
        />
        <div className="flex items-center justify-between">
          <p className="body-sm text-[var(--ink-4)]">{message.length} / 4000</p>
          {userEmail && <p className="body-sm text-[var(--ink-4)]">{tr('review.fromPrefix')}{userEmail}</p>}
        </div>
      </GlassCard>

      <div className="flex justify-end gap-2">
        <PillButton variant="secondary" size="sm" onClick={() => router.push('/studio')}>
          {tr('review.cancel')}
        </PillButton>
        <PillButton size="sm" onClick={submit} disabled={submitting || !message.trim()}>
          {submitting ? tr('review.sending') : tr('review.sendFeedback')}
        </PillButton>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CheckCircle } from 'lucide-react'
import type { AvailabilityBlock } from '@prisma/client'

interface Props {
  blocks: AvailabilityBlock[]
  showName: string
  userId: string
  showId: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function TeamCalendarClient({ blocks, showName, userId, showId }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmBooking() {
    const block = blocks.find((b) => b.id === selected)
    if (!block || !name.trim() || !EMAIL_RE.test(email)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          showId,
          date: String(block.date).slice(0, 10),
          time: block.timeFrom,
          guestName: name.trim(),
          guestEmail: email.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not complete the booking.')
        return
      }
      setConfirmed(true)
    } catch {
      setError('Could not complete the booking.')
    } finally {
      setSubmitting(false)
    }
  }

  function formatSlot(block: AvailabilityBlock) {
    // Availability is stored as a date-only value; format in UTC so the day
    // shown matches the day the host marked (and the invite that gets sent).
    const d = new Date(block.date)
    const dateStr = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
    })
    return block.timeFrom ? `${dateStr} at ${block.timeFrom}` : dateStr
  }

  if (confirmed) return (
    <div className="text-center py-12">
      <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#4ade80' }} />
      <h2 className="display-sm text-[var(--ink-1)] mb-2">You're booked!</h2>
      <p className="body text-[var(--ink-2)]">We'll send details to <strong>{email}</strong>.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="body-sm text-[var(--ink-3)]">Select a slot:</p>
      <div className="space-y-2">
        {blocks.map(block => (
          <button
            key={block.id}
            onClick={() => setSelected(block.id)}
            className="w-full text-left transition-colors"
          >
            <GlassCard className={`p-4 ${selected === block.id ? 'ring-1 ring-[var(--accent-violet)]' : ''}`} hover>
              <p className="body-sm font-medium text-[var(--ink-1)]">{formatSlot(block)}</p>
              {block.note && <p className="body-sm text-[var(--ink-3)] mt-1">{block.note}</p>}
            </GlassCard>
          </button>
        ))}
      </div>

      {selected && (
        <GlassCard className="p-4 space-y-3">
          <p className="body-sm font-semibold text-[var(--ink-1)]">Your details</p>
          <div className="space-y-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-[var(--radius-sm)] px-3 py-2 body-sm"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
            />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email"
              type="email"
              className="w-full rounded-[var(--radius-sm)] px-3 py-2 body-sm"
              style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
            />
          </div>
          {error && <p className="body-sm" style={{ color: 'var(--error)' }}>{error}</p>}
          <PillButton
            size="sm"
            onClick={confirmBooking}
            disabled={!name.trim() || !EMAIL_RE.test(email) || submitting}
          >
            {submitting ? 'Sending invite…' : 'Confirm booking'}
          </PillButton>
        </GlassCard>
      )}
    </div>
  )
}

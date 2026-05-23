'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CheckCircle } from 'lucide-react'
import type { AvailabilityBlock } from '@prisma/client'

interface Props {
  blocks: AvailabilityBlock[]
  showName: string
}

export function TeamCalendarClient({ blocks, showName }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function formatSlot(block: AvailabilityBlock) {
    const d = new Date(block.date)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
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
          <PillButton
            size="sm"
            onClick={() => { if (name && email) setConfirmed(true) }}
            disabled={!name || !email}
          >
            Confirm booking
          </PillButton>
        </GlassCard>
      )}
    </div>
  )
}

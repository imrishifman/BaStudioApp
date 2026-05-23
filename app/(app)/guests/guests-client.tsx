'use client'

import { useState } from 'react'
import type { Guest } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { initials } from '@/lib/utils'
import { Plus, ExternalLink } from 'lucide-react'

type GuestStatus = 'wishlist' | 'outreach_sent' | 'confirmed' | 'recorded' | 'published'

const COLUMNS: { key: GuestStatus; label: string }[] = [
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'outreach_sent', label: 'Outreach sent' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'recorded', label: 'Recorded' },
  { key: 'published', label: 'Published' },
]

interface Props { guests: Guest[] }

export function GuestsClient({ guests: initialGuests }: Props) {
  const [guests, setGuests] = useState(initialGuests)

  async function moveGuest(guestId: string, newStatus: GuestStatus) {
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, pipelineStatus: newStatus } : g))
    await fetch(`/api/guests/${guestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStatus: newStatus }),
    })
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="display-sm text-[var(--ink-1)]">Guests</h1>
        <PillButton size="sm" onClick={() => {/* TODO: open create modal */}}>
          <Plus size={14} /> Add guest
        </PillButton>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const colGuests = guests.filter(g => g.pipelineStatus === col.key)
          return (
            <div key={col.key} className="flex w-64 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="body-sm font-semibold text-[var(--ink-2)]">{col.label}</p>
                <span className="body-sm rounded-full px-2 py-0.5 text-[var(--ink-3)]" style={{ background: 'var(--bg-2)' }}>
                  {colGuests.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 rounded-[var(--radius-md)] p-2 min-h-[120px]" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}>
                {colGuests.map(guest => (
                  <GlassCard key={guest.id} className="p-3 cursor-pointer group">
                    <div className="flex items-start gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                        style={{
                          background: guest.photoUrl ? undefined : 'var(--bg-3)',
                          backgroundImage: guest.photoUrl ? `url(${guest.photoUrl})` : undefined,
                          backgroundSize: 'cover',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {!guest.photoUrl && initials(guest.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="body-sm font-semibold text-[var(--ink-1)] truncate">{guest.name}</p>
                        {guest.timesInterviewed > 0 && (
                          <p className="body-sm text-[var(--ink-3)]">{guest.timesInterviewed}× interviewed</p>
                        )}
                      </div>
                    </div>
                    {/* Move buttons on hover */}
                    <div className="mt-2 hidden gap-1 group-hover:flex flex-wrap">
                      {COLUMNS.filter(c => c.key !== col.key).map(target => (
                        <button
                          key={target.key}
                          onClick={() => moveGuest(guest.id, target.key)}
                          className="body-sm rounded px-1.5 py-0.5 text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                          style={{ background: 'var(--bg-3)' }}
                        >
                          → {target.label}
                        </button>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

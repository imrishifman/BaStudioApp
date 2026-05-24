'use client'

import { useState } from 'react'
import type { Guest, GuestStatus } from '@prisma/client'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { GlassCard } from '@/components/common/GlassCard'
import { initials } from '@/lib/utils'

type ColumnKey = 'cold' | 'warm' | 'recorded' | 'published'

const COLUMNS: {
  key: ColumnKey
  label: string
  hint: string
  color: string
  status: GuestStatus
  statuses: GuestStatus[]
}[] = [
  {
    key: 'cold',
    label: 'Cold',
    hint: 'On your wishlist',
    color: '#67e8f9',
    status: 'wishlist',
    statuses: ['wishlist'],
  },
  {
    key: 'warm',
    label: 'Warm',
    hint: 'Reached out / confirmed',
    color: '#ffd60a',
    status: 'confirmed',
    statuses: ['outreach_sent', 'confirmed'],
  },
  {
    key: 'recorded',
    label: 'Recorded',
    hint: 'In the can',
    color: '#a78bfa',
    status: 'recorded',
    statuses: ['recorded'],
  },
  {
    key: 'published',
    label: 'Published',
    hint: 'Live to the world',
    color: '#30d158',
    status: 'published',
    statuses: ['published'],
  },
]

export function GuestsClient({
  guests: initialGuests,
  embedded = false,
}: {
  guests: Guest[]
  embedded?: boolean
}) {
  const [guests, setGuests] = useState(initialGuests)

  function columnOf(g: Guest): ColumnKey {
    return COLUMNS.find((c) => c.statuses.includes(g.pipelineStatus))?.key ?? 'cold'
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || source.droppableId === destination.droppableId) return
    const col = COLUMNS.find((c) => c.key === destination.droppableId)
    if (!col) return

    setGuests((prev) =>
      prev.map((g) => (g.id === draggableId ? { ...g, pipelineStatus: col.status } : g))
    )
    try {
      await fetch(`/api/guests/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStatus: col.status }),
      })
    } catch {
      /* optimistic update already applied */
    }
  }

  return (
    <div className={embedded ? '' : 'p-6 lg:p-8'}>
      {!embedded && (
        <div className="mb-1">
          <h1 className="display-sm text-[var(--ink-1)]">Guests</h1>
        </div>
      )}
      <p className="body-sm mb-6 text-[var(--ink-3)]">
        Drag a guest across the pipeline as your relationship warms up.
      </p>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colGuests = guests.filter((g) => columnOf(g) === col.key)
            return (
              <div key={col.key} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: col.color }}
                    />
                    <div>
                      <p className="body-sm font-semibold text-[var(--ink-1)]">{col.label}</p>
                      <p className="text-[11px] text-[var(--ink-4)]">{col.hint}</p>
                    </div>
                  </div>
                  <span
                    className="body-sm rounded-full px-2 py-0.5 text-[var(--ink-3)]"
                    style={{ background: 'var(--bg-2)' }}
                  >
                    {colGuests.length}
                  </span>
                </div>

                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex min-h-[160px] flex-col gap-2 rounded-[var(--radius-md)] p-2 transition-colors"
                      style={{
                        background: snapshot.isDraggingOver
                          ? `${col.color}14`
                          : 'var(--bg-1)',
                        border: `1px solid ${
                          snapshot.isDraggingOver ? col.color : 'var(--line-1)'
                        }`,
                        borderTop: `2px solid ${col.color}`,
                      }}
                    >
                      {colGuests.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-1 items-center justify-center py-6">
                          <p className="body-sm text-[var(--ink-4)]">Drag guests here</p>
                        </div>
                      )}
                      {colGuests.map((guest, i) => (
                        <Draggable key={guest.id} draggableId={guest.id} index={i}>
                          {(p, snap) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              style={p.draggableProps.style}
                            >
                              <GlassCard
                                className="p-3"
                                style={{
                                  cursor: 'grab',
                                  opacity: snap.isDragging ? 0.92 : 1,
                                  boxShadow: snap.isDragging
                                    ? `0 8px 24px ${col.color}33`
                                    : undefined,
                                }}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                                    style={{
                                      background: guest.photoUrl ? undefined : 'var(--bg-3)',
                                      backgroundImage: guest.photoUrl
                                        ? `url(${guest.photoUrl})`
                                        : undefined,
                                      backgroundSize: 'cover',
                                      color: 'var(--ink-2)',
                                    }}
                                  >
                                    {!guest.photoUrl && initials(guest.name)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="body-sm truncate font-semibold text-[var(--ink-1)]">
                                      {guest.name}
                                    </p>
                                    {guest.timesInterviewed > 0 && (
                                      <p className="text-[11px] text-[var(--ink-3)]">
                                        {guest.timesInterviewed}× interviewed
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {guest.topics && guest.topics.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {guest.topics.slice(0, 3).map((t) => (
                                      <span
                                        key={t}
                                        className="rounded-full px-2 py-0.5 text-[11px] text-[var(--ink-3)]"
                                        style={{ background: 'var(--bg-3)' }}
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </GlassCard>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {guests.length === 0 && (
        <GlassCard className="mt-4 p-8 text-center">
          <p className="body text-[var(--ink-2)]">No guests yet.</p>
          <p className="body-sm mt-1 text-[var(--ink-3)]">
            Guests are added automatically when you research them in an episode.
          </p>
        </GlassCard>
      )}
    </div>
  )
}

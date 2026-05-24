'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  differenceInCalendarDays,
} from 'date-fns'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { GlassCard } from '@/components/common/GlassCard'
import { cn, initials } from '@/lib/utils'

interface EpisodeEvent {
  id: string
  title: string | null
  guestName: string
  guestPhotoUrl: string | null
  releaseDate: string | null
  status: string
  show: { name: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--ink-3)',
  researching: 'var(--accent-violet)',
  focusing: 'var(--accent-cyan)',
  questions: 'var(--accent-cyan)',
  intro: 'var(--accent-pink)',
  script: 'var(--accent-pink)',
  video: 'var(--warning)',
  review: 'var(--warning)',
  approved: 'var(--success)',
  published: '#30d158',
}

const LEGEND = [
  { label: 'Researching', color: 'var(--accent-violet)' },
  { label: 'Questions', color: 'var(--accent-cyan)' },
  { label: 'Script', color: 'var(--accent-pink)' },
  { label: 'Review', color: 'var(--warning)' },
  { label: 'Published', color: '#30d158' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function statusColor(status: string) {
  return STATUS_COLOR[status] ?? 'var(--ink-4)'
}

export function CalendarClient({ episodes: initial }: { episodes: EpisodeEvent[] }) {
  const [episodes, setEpisodes] = useState(initial)
  const [current, setCurrent] = useState(new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(current), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(current), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [current])

  const scheduled = episodes.filter((e) => e.releaseDate)
  const unscheduled = episodes.filter((e) => !e.releaseDate)

  const upcoming = useMemo(() => {
    const now = new Date()
    return scheduled
      .filter((e) => {
        const diff = differenceInCalendarDays(new Date(e.releaseDate!), now)
        return diff >= 0 && diff <= 60
      })
      .sort((a, b) => +new Date(a.releaseDate!) - +new Date(b.releaseDate!))
  }, [scheduled])

  function episodesOn(day: Date) {
    return scheduled.filter((e) => isSameDay(new Date(e.releaseDate!), day))
  }

  async function onDragEnd(result: DropResult) {
    const { draggableId, destination } = result
    if (!destination) return

    const destId = destination.droppableId
    const newIso =
      destId === 'unscheduled' ? null : new Date(`${destId}T12:00:00`).toISOString()

    setEpisodes((prev) =>
      prev.map((e) => (e.id === draggableId ? { ...e, releaseDate: newIso } : e))
    )
    try {
      await fetch(`/api/episodes/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseDate: newIso }),
      })
      toast.success(
        newIso ? `Rescheduled to ${format(new Date(newIso), 'MMM d')}` : 'Moved to unscheduled'
      )
    } catch {
      toast.error('Could not reschedule')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-sm text-[var(--ink-1)]">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrent(new Date())}
            className="body-sm rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrent((c) => addMonths(c, -1))}
              className="rounded-full p-2 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="body w-36 text-center font-semibold text-[var(--ink-1)]">
              {format(current, 'MMMM yyyy')}
            </p>
            <button
              onClick={() => setCurrent((c) => addMonths(c, 1))}
              className="rounded-full p-2 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming recordings strip */}
      {upcoming.length > 0 && (
        <div>
          <p className="body-sm mb-3 font-semibold text-[var(--ink-2)]">
            Upcoming recordings
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map((ep) => {
              const days = differenceInCalendarDays(new Date(ep.releaseDate!), new Date())
              const countdownColor =
                days <= 3 ? 'var(--error)' : days <= 7 ? 'var(--warning)' : 'var(--ink-3)'
              return (
                <GlassCard key={ep.id} className="flex w-56 shrink-0 flex-col gap-2 p-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{
                        background: ep.guestPhotoUrl ? undefined : 'var(--bg-3)',
                        backgroundImage: ep.guestPhotoUrl ? `url(${ep.guestPhotoUrl})` : undefined,
                        backgroundSize: 'cover',
                        color: 'var(--ink-2)',
                      }}
                    >
                      {!ep.guestPhotoUrl && initials(ep.guestName)}
                    </div>
                    <div className="min-w-0">
                      <p className="body-sm truncate font-semibold text-[var(--ink-1)]">
                        {ep.guestName}
                      </p>
                      <p className="truncate text-[11px] text-[var(--ink-3)]">
                        {ep.show?.name ?? 'No show'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="body-sm text-[var(--ink-2)]">
                      Airs {format(new Date(ep.releaseDate!), 'MMM d')}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: countdownColor }}>
                      {days === 0 ? 'Today' : `In ${days}d`}
                    </span>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[11px] text-[var(--ink-3)]">{l.label}</span>
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Grid */}
        <GlassCard className="overflow-hidden p-0">
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--line-1)' }}>
            {DAYS.map((d) => (
              <div key={d} className="eyebrow p-3 text-center text-[var(--ink-3)]">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, current)
              const today = isSameDay(day, new Date())
              const key = format(day, 'yyyy-MM-dd')
              const dayEps = episodesOn(day)
              return (
                <Droppable droppableId={key} key={key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[96px] p-1.5 transition-colors"
                      style={{
                        borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--line-1)' : 'none',
                        borderBottom: i < days.length - 7 ? '1px solid var(--line-1)' : 'none',
                        background: snapshot.isDraggingOver
                          ? 'rgba(103,232,249,0.08)'
                          : 'transparent',
                        opacity: inMonth ? 1 : 0.4,
                      }}
                    >
                      <div
                        className={cn(
                          'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
                          today
                            ? 'text-[var(--bg-0)]'
                            : 'text-[var(--ink-2)]'
                        )}
                        style={today ? { background: 'var(--accent-cyan)' } : undefined}
                      >
                        {format(day, 'd')}
                      </div>
                      {dayEps.map((ep, idx) => (
                        <Draggable key={ep.id} draggableId={ep.id} index={idx}>
                          {(p, snap) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className="mb-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                              style={{
                                ...p.draggableProps.style,
                                background: `${statusColor(ep.status)}22`,
                                color: statusColor(ep.status),
                                boxShadow: snap.isDragging
                                  ? `0 6px 16px ${statusColor(ep.status)}44`
                                  : undefined,
                              }}
                              title={`${ep.title ?? ep.guestName} · ${ep.status}`}
                            >
                              {ep.title ?? ep.guestName}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </GlassCard>

        {/* Unscheduled tray */}
        <div>
          <p className="body-sm mb-2 font-semibold text-[var(--ink-2)]">
            Unscheduled {unscheduled.length > 0 && `(${unscheduled.length})`}
          </p>
          <Droppable droppableId="unscheduled" direction="horizontal">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex min-h-[64px] flex-wrap gap-2 rounded-[var(--radius-md)] border border-dashed p-3 transition-colors"
                style={{
                  borderColor: snapshot.isDraggingOver ? 'var(--accent-cyan)' : 'var(--line-2)',
                  background: snapshot.isDraggingOver ? 'rgba(103,232,249,0.06)' : 'transparent',
                }}
              >
                {unscheduled.length === 0 && !snapshot.isDraggingOver && (
                  <p className="body-sm self-center text-[var(--ink-4)]">
                    Drag an episode here to unschedule it.
                  </p>
                )}
                {unscheduled.map((ep, idx) => (
                  <Draggable key={ep.id} draggableId={ep.id} index={idx}>
                    {(p, snap) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                        style={{
                          ...p.draggableProps.style,
                          background: `${statusColor(ep.status)}22`,
                          color: statusColor(ep.status),
                          boxShadow: snap.isDragging
                            ? `0 6px 16px ${statusColor(ep.status)}44`
                            : undefined,
                        }}
                      >
                        {ep.title ?? ep.guestName}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>
    </div>
  )
}

'use client'

import { useMemo, useRef, useState } from 'react'
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
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
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

type AvailStatus = 'available' | 'busy'
interface AvailBlock {
  date: string
  status: AvailStatus
  note: string | null
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

const EPISODE_LEGEND = [
  { label: 'Researching', color: 'var(--accent-violet)' },
  { label: 'Questions', color: 'var(--accent-cyan)' },
  { label: 'Script', color: 'var(--accent-pink)' },
  { label: 'Review', color: 'var(--warning)' },
  { label: 'Published', color: '#30d158' },
]

const AVAIL_COLOR: Record<AvailStatus, string> = {
  available: '#30d158',
  busy: 'var(--error)',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const statusColor = (s: string) => STATUS_COLOR[s] ?? 'var(--ink-4)'

export function CalendarClient({
  episodes: initial,
  availability,
}: {
  episodes: EpisodeEvent[]
  availability: AvailBlock[]
}) {
  const [episodes, setEpisodes] = useState(initial)
  const [current, setCurrent] = useState(new Date())
  const [mode, setMode] = useState<'episodes' | 'availability'>('episodes')
  const [selectedChip, setSelectedChip] = useState<AvailStatus | null>(null)
  const dragStatus = useRef<AvailStatus | null>(null)

  const [availMap, setAvailMap] = useState<Record<string, AvailStatus>>(() => {
    const m: Record<string, AvailStatus> = {}
    for (const b of availability) m[b.date.slice(0, 10)] = b.status
    return m
  })

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
    const newIso = destId === 'unscheduled' ? null : new Date(`${destId}T12:00:00`).toISOString()
    setEpisodes((prev) =>
      prev.map((e) => (e.id === draggableId ? { ...e, releaseDate: newIso } : e))
    )
    try {
      await fetch(`/api/episodes/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseDate: newIso }),
      })
      toast.success(newIso ? `Rescheduled to ${format(new Date(newIso), 'MMM d')}` : 'Unscheduled')
    } catch {
      toast.error('Could not reschedule')
    }
  }

  async function setAvail(key: string, status: AvailStatus) {
    setAvailMap((prev) => ({ ...prev, [key]: status }))
    try {
      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: key, status }),
      })
    } catch {
      toast.error('Could not save availability')
    }
  }

  async function clearAvail(key: string) {
    setAvailMap((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: key }),
      })
    } catch {
      /* optimistic */
    }
  }

  const legend = mode === 'episodes'
    ? EPISODE_LEGEND
    : [
        { label: 'Available', color: AVAIL_COLOR.available },
        { label: 'Busy', color: AVAIL_COLOR.busy },
      ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-sm text-[var(--ink-1)]">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex gap-1 rounded-full p-1"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
          >
            {(['episodes', 'availability'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'body-sm rounded-full px-3 py-1.5 font-semibold capitalize transition-all',
                  mode === m ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrent(new Date())}
            className="body-sm rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrent((c) => addMonths(c, -1))} className="rounded-full p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]">
              <ChevronLeft size={18} />
            </button>
            <p className="body w-36 text-center font-semibold text-[var(--ink-1)]">
              {format(current, 'MMMM yyyy')}
            </p>
            <button onClick={() => setCurrent((c) => addMonths(c, 1))} className="rounded-full p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Availability chips */}
      {mode === 'availability' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="body-sm text-[var(--ink-3)]">Drag or tap a chip, then a day:</p>
          {(['available', 'busy'] as AvailStatus[]).map((s) => (
            <button
              key={s}
              draggable
              onDragStart={() => (dragStatus.current = s)}
              onClick={() => setSelectedChip((cur) => (cur === s ? null : s))}
              className="flex cursor-grab items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold capitalize transition-all"
              style={{
                borderColor: selectedChip === s ? AVAIL_COLOR[s] : 'var(--line-2)',
                background: selectedChip === s ? `${AVAIL_COLOR[s]}1f` : 'transparent',
                color: AVAIL_COLOR[s],
              }}
            >
              {s === 'available' ? <Check size={13} /> : <X size={13} />} {s}
            </button>
          ))}
        </div>
      )}

      {/* Upcoming strip (episodes mode only) */}
      {mode === 'episodes' && upcoming.length > 0 && (
        <div>
          <p className="body-sm mb-3 font-semibold text-[var(--ink-2)]">Upcoming recordings</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map((ep) => {
              const d = differenceInCalendarDays(new Date(ep.releaseDate!), new Date())
              const cc = d <= 3 ? 'var(--error)' : d <= 7 ? 'var(--warning)' : 'var(--ink-3)'
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
                      <p className="body-sm truncate font-semibold text-[var(--ink-1)]">{ep.guestName}</p>
                      <p className="truncate text-[11px] text-[var(--ink-3)]">{ep.show?.name ?? 'No show'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="body-sm text-[var(--ink-2)]">Airs {format(new Date(ep.releaseDate!), 'MMM d')}</span>
                    <span className="text-[11px] font-semibold" style={{ color: cc }}>
                      {d === 0 ? 'Today' : `In ${d}d`}
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
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[11px] text-[var(--ink-3)]">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Day headers (shared) */}
      <GlassCard className="overflow-hidden p-0">
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--line-1)' }}>
          {DAYS.map((d) => (
            <div key={d} className="eyebrow p-3 text-center text-[var(--ink-3)]">
              {d}
            </div>
          ))}
        </div>

        {mode === 'episodes' ? (
          <DragDropContext onDragEnd={onDragEnd}>
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
                        className="min-h-[96px] p-1.5"
                        style={{
                          borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--line-1)' : 'none',
                          borderBottom: i < days.length - 7 ? '1px solid var(--line-1)' : 'none',
                          background: snapshot.isDraggingOver ? 'rgba(103,232,249,0.08)' : 'transparent',
                          opacity: inMonth ? 1 : 0.4,
                        }}
                      >
                        <DayNumber day={day} today={today} />
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
                                  boxShadow: snap.isDragging ? `0 6px 16px ${statusColor(ep.status)}44` : undefined,
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
          </DragDropContext>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, current)
              const today = isSameDay(day, new Date())
              const key = format(day, 'yyyy-MM-dd')
              const avail = availMap[key]
              return (
                <div
                  key={key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragStatus.current) setAvail(key, dragStatus.current)
                    dragStatus.current = null
                  }}
                  onClick={() => {
                    if (selectedChip) setAvail(key, selectedChip)
                    else if (avail) clearAvail(key)
                  }}
                  className="min-h-[96px] cursor-pointer p-1.5"
                  style={{
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--line-1)' : 'none',
                    borderBottom: i < days.length - 7 ? '1px solid var(--line-1)' : 'none',
                    background: avail ? `${AVAIL_COLOR[avail]}12` : 'transparent',
                    borderLeft: avail ? `2px solid ${AVAIL_COLOR[avail]}` : undefined,
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <DayNumber day={day} today={today} />
                  {avail && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                      style={{ background: `${AVAIL_COLOR[avail]}22`, color: AVAIL_COLOR[avail] }}
                    >
                      {avail === 'available' ? <Check size={11} /> : <X size={11} />} {avail}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Unscheduled tray (episodes mode only) */}
      {mode === 'episodes' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div>
            <p className="body-sm mb-2 font-semibold text-[var(--ink-2)]">
              Unscheduled {unscheduled.length > 0 && `(${unscheduled.length})`}
            </p>
            <Droppable droppableId="unscheduled" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex min-h-[64px] flex-wrap gap-2 rounded-[var(--radius-md)] border border-dashed p-3"
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
                            boxShadow: snap.isDragging ? `0 6px 16px ${statusColor(ep.status)}44` : undefined,
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
      )}
    </div>
  )
}

function DayNumber({ day, today }: { day: Date; today: boolean }) {
  return (
    <div
      className={cn(
        'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
        today ? 'text-[var(--bg-0)]' : 'text-[var(--ink-2)]'
      )}
      style={today ? { background: 'var(--accent-cyan)' } : undefined}
    >
      {format(day, 'd')}
    </div>
  )
}

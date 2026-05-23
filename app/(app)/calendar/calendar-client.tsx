'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface EpisodeEvent {
  id: string
  title: string | null
  guestName: string
  releaseDate: string
  status: string
}

interface Props { episodes: EpisodeEvent[] }

const STATUS_COLOR: Record<string, string> = {
  approved: 'var(--success)', published: 'var(--accent-cyan)',
  review: 'var(--warning)', draft: 'var(--ink-3)',
}

export function CalendarClient({ episodes }: Props) {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [current, setCurrent] = useState(new Date())

  const year = current.getFullYear()
  const month = current.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    return day > 0 && day <= daysInMonth ? day : null
  })

  function episodesOnDay(day: number) {
    return episodes.filter(ep => {
      const d = new Date(ep.releaseDate)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const today = new Date()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="display-sm text-[var(--ink-1)]">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
            {(['month', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('body-sm rounded-full px-3 py-1.5 font-semibold capitalize transition-all', view === v ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]')}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(new Date(year, month - 1))} className="p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]"><ChevronLeft size={18} /></button>
        <p className="body font-semibold text-[var(--ink-1)]">{MONTHS[month]} {year}</p>
        <button onClick={() => setCurrent(new Date(year, month + 1))} className="p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]"><ChevronRight size={18} /></button>
      </div>

      {/* Calendar grid */}
      <GlassCard className="overflow-hidden p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--line-1)' }}>
          {DAYS.map(d => <div key={d} className="eyebrow p-3 text-center text-[var(--ink-3)]">{d}</div>)}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayEps = day ? episodesOnDay(day) : []
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            return (
              <div
                key={i}
                className="min-h-[88px] p-2"
                style={{ borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--line-1)' : 'none', borderBottom: i < 35 ? '1px solid var(--line-1)' : 'none' }}
              >
                {day && (
                  <>
                    <p className={cn('body-sm mb-1 h-6 w-6 flex items-center justify-center rounded-full font-semibold', isToday ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-2)]')}>
                      {day}
                    </p>
                    {dayEps.map(ep => (
                      <Link key={ep.id} href={`/episodes/${ep.id}`}>
                        <div className="mb-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ background: `${STATUS_COLOR[ep.status] ?? 'var(--ink-4)'}22`, color: STATUS_COLOR[ep.status] ?? 'var(--ink-4)' }}>
                          {ep.title ?? ep.guestName}
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* Upcoming list */}
      {episodes.length > 0 && (
        <div>
          <p className="body mb-3 font-semibold text-[var(--ink-1)]">Upcoming releases</p>
          <div className="space-y-2">
            {episodes.slice(0, 5).map(ep => (
              <Link key={ep.id} href={`/episodes/${ep.id}`}>
                <GlassCard hover className="flex items-center justify-between gap-4 p-4">
                  <p className="body font-medium text-[var(--ink-1)]">{ep.title ?? ep.guestName}</p>
                  <p className="body-sm shrink-0 text-[var(--ink-3)]">{formatDate(ep.releaseDate)}</p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

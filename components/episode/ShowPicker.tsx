'use client'

import { useState, useRef, useEffect } from 'react'
import type { Show } from '@prisma/client'
import { FolderPlus, FolderCheck, ChevronDown, Check } from 'lucide-react'

// Inline dropdown to move the current episode into one of the user's shows
// (or unassign). Used in the wizard header. Lives in client-only state and
// reports the new showId via onChange so the parent can PATCH + refresh.
export function ShowPicker({
  shows,
  currentShowId,
  onChange,
  disabled,
}: {
  shows: Show[]
  currentShowId: string | null | undefined
  onChange: (showId: string | null) => void | Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = shows.find((s) => s.id === currentShowId) ?? null

  // Click-outside to dismiss.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (shows.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="body-sm flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-colors disabled:opacity-50"
        style={{
          borderColor: 'var(--line-2)',
          color: current ? 'var(--ink-1)' : 'var(--ink-3)',
          background: 'transparent',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current ? `Part of ${current.name}` : 'Assign to a show'}
      >
        {current ? <FolderCheck size={13} /> : <FolderPlus size={13} />}
        <span className="max-w-[120px] truncate">{current ? current.name : 'No show'}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-[var(--radius-sm)] border shadow-xl"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line-1)' }}
          role="listbox"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onChange(null) }}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-3)]"
          >
            <span className="body-sm text-[var(--ink-2)]">No show (unassign)</span>
            {!current && <Check size={14} className="text-[var(--accent-violet)]" />}
          </button>
          <div style={{ borderTop: '1px solid var(--line-1)' }} />
          {shows.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setOpen(false); onChange(s.id) }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-3)]"
            >
              <span className="body-sm truncate text-[var(--ink-1)]">{s.name}</span>
              {current?.id === s.id && <Check size={14} className="text-[var(--accent-violet)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

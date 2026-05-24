'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PillButton } from '@/components/common/PillButton'
import { initials, formatDate } from '@/lib/utils'

interface Comment {
  id: string
  message: string
  authorEmail: string
  authorName: string | null
  createdAt: string
}

export function EpisodeChatPanel({
  episodeId,
  episodeTitle,
  currentEmail,
  onClose,
}: {
  episodeId: string
  episodeTitle: string
  currentEmail: string
  onClose: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments`)
      if (res.ok) setComments(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function send() {
    const message = draft.trim()
    if (!message) return
    setDraft('')
    const res = await fetch(`/api/episodes/${episodeId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (res.ok) {
      const created = await res.json()
      setComments((prev) => [...prev, created])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col"
        style={{ background: 'var(--bg-1)', borderLeft: '1px solid var(--line-1)' }}
      >
        <div className="flex items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <div className="min-w-0">
            <p className="body-sm font-semibold text-[var(--ink-1)]">Episode chat</p>
            <p className="truncate text-[12px] text-[var(--ink-3)]">{episodeTitle}</p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink-1)]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <p className="body-sm text-center text-[var(--ink-4)]">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="body-sm py-8 text-center text-[var(--ink-4)]">No comments yet. Start the conversation.</p>
          )}
          {comments.map((c) => {
            const isMe = c.authorEmail === currentEmail
            return (
              <div key={c.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                  {initials(c.authorName ?? c.authorEmail)}
                </div>
                <div className={`flex max-w-[75%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="rounded-[14px] px-3 py-2" style={isMe ? { background: 'var(--ink-1)', color: 'var(--bg-0)' } : { background: 'var(--bg-2)', color: 'var(--ink-1)' }}>
                    <p className="body-sm">{c.message}</p>
                  </div>
                  <p className="text-[11px] text-[var(--ink-4)]">{formatDate(c.createdAt)}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--line-1)' }}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Add a comment…"
            className="flex-1 border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
          />
          <PillButton size="sm" onClick={send} disabled={!draft.trim()}>
            <Send size={14} />
          </PillButton>
        </div>
      </div>
    </div>
  )
}

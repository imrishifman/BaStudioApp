'use client'

import { useState, useEffect, useRef } from 'react'
import type { Show } from '@prisma/client'
import type { Session } from 'next-auth'
import { GlassCard } from '@/components/common/GlassCard'
import { Input } from '@/components/ui/input'
import { PillButton } from '@/components/common/PillButton'
import { initials, formatDate } from '@/lib/utils'
import { Send } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Message {
  id: string
  message: string
  senderEmail: string
  senderName: string | null
  createdAt: string
  sender: { fullName: string | null; email: string }
}

interface Props {
  shows: Show[]
  initialMessages: Message[]
  sessionUser: Session['user']
}

export function TeamClient({ shows, initialMessages, sessionUser }: Props) {
  const [selectedShowId, setSelectedShowId] = useState(shows[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: messages = initialMessages } = useQuery<Message[]>({
    queryKey: ['team-messages', selectedShowId],
    queryFn: async () => {
      const res = await fetch(`/api/team/messages?showId=${selectedShowId}`)
      return res.json()
    },
    initialData: initialMessages,
    refetchInterval: 4000,
    enabled: !!selectedShowId,
  })

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      await fetch('/api/team/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: selectedShowId, message: msg }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-messages', selectedShowId] }),
  })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!draft.trim()) return
    sendMutation.mutate(draft)
    setDraft('')
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-6 p-6 lg:p-8" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Roster sidebar */}
      <div className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
        <p className="body font-semibold text-[var(--ink-1)]">Hub</p>
        <GlassCard className="flex-1 p-3">
          <p className="eyebrow mb-3 text-[var(--ink-3)]">Shows</p>
          {shows.map(show => (
            <button
              key={show.id}
              onClick={() => setSelectedShowId(show.id)}
              className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={selectedShowId === show.id ? { background: 'rgba(255,255,255,0.08)' } : {}}
            >
              <p className="body-sm font-medium text-[var(--ink-1)]">{show.name}</p>
            </button>
          ))}
        </GlassCard>
      </div>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <GlassCard className="flex flex-1 flex-col overflow-hidden p-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => {
              const isMe = msg.senderEmail === sessionUser.email
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                  >
                    {initials(msg.sender.fullName ?? msg.senderEmail)}
                  </div>
                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div
                      className="rounded-[14px] px-3 py-2"
                      style={isMe ? { background: 'var(--ink-1)', color: 'var(--bg-0)' } : { background: 'var(--bg-2)', color: 'var(--ink-1)' }}
                    >
                      <p className="body-sm">{msg.message}</p>
                    </div>
                    <p className="body-sm text-[var(--ink-4)]">{formatDate(msg.createdAt)}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-3" style={{ borderTop: '1px solid var(--line-1)' }}>
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Message the team…"
              className="flex-1 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <PillButton size="sm" onClick={handleSend} disabled={!draft.trim()}>
              <Send size={14} />
            </PillButton>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

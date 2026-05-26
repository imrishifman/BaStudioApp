'use client'

import { useState, useEffect, useRef } from 'react'
import type { Show, Team } from '@prisma/client'
import type { Session } from 'next-auth'
import { GlassCard } from '@/components/common/GlassCard'
import { Input } from '@/components/ui/input'
import { PillButton } from '@/components/common/PillButton'
import { NewTeamModal } from '@/components/team/NewTeamModal'
import { initials, formatDate, cn } from '@/lib/utils'
import {
  Send, Plus, Pencil, Trash2, ArrowLeft, MessageSquare, Tv2, Users,
} from 'lucide-react'
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
  teams: Team[]
  lastMessages: Record<string, { message: string; createdAt: string } | null>
  sessionUser: Session['user']
}

export function TeamClient({ shows, teams, lastMessages, sessionUser }: Props) {
  const [tab, setTab] = useState<'chat' | 'teams'>('chat')

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-sm text-[var(--ink-1)]">Hub</h1>
        <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
          {(['chat', 'teams'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'body-sm rounded-full px-4 py-1.5 font-semibold capitalize transition-all',
                tab === t ? 'bg-[var(--ink-1)] text-[var(--bg-0)]' : 'text-[var(--ink-3)]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' ? (
        shows.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <p className="display-sm text-[var(--ink-1)]">No groups yet</p>
            <p className="body mt-2 text-[var(--ink-2)]">Create a show to start a group chat.</p>
          </GlassCard>
        ) : (
          <ChatWhatsApp shows={shows} lastMessages={lastMessages} sessionUser={sessionUser} />
        )
      ) : (
        <TeamsPanel teams={teams} shows={shows} />
      )}
    </div>
  )
}

/* ---------------- Teams tab ---------------- */

function TeamsPanel({ teams, shows }: { teams: Team[]; shows: Show[] }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const showName = (id: string | null) => shows.find((s) => s.id === id)?.name

  async function del(id: string) {
    await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PillButton
          size="sm"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          <Plus size={14} /> New Team
        </PillButton>
      </div>

      {teams.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--bg-3)' }}>
            <Users size={22} style={{ color: 'var(--accent-violet)' }} />
          </div>
          <p className="body font-semibold text-[var(--ink-1)]">No teams yet</p>
          <p className="body-sm text-[var(--ink-3)]">
            Create a team, attach it to a show, and add members - it&apos;ll auto-attach to that show&apos;s new episodes.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <GlassCard key={team.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="body font-semibold text-[var(--ink-1)]">{team.name}</p>
                  <p className="body-sm flex items-center gap-1.5 text-[var(--ink-3)]">
                    <Tv2 size={13} />
                    {team.showId ? `Attached to ${showName(team.showId) ?? 'a show'}` : 'Not attached to a show'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setEditing(team)
                      setModalOpen(true)
                    }}
                    className="rounded-full p-2 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
                    aria-label="Edit team"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => del(team.id)}
                    className="rounded-full p-2 text-[var(--ink-4)] transition-colors hover:text-[var(--error)]"
                    aria-label="Delete team"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {team.memberEmails.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {team.memberEmails.map((m) => (
                    <span
                      key={m}
                      className="rounded-full px-2.5 py-1 text-[12px]"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <NewTeamModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        team={editing}
        shows={shows}
        onSaved={() => window.location.reload()}
      />
    </div>
  )
}

/* ---------------- WhatsApp-style chat ---------------- */

function ChatWhatsApp({
  shows,
  lastMessages,
  sessionUser,
}: {
  shows: Show[]
  lastMessages: Props['lastMessages']
  sessionUser: Session['user']
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openShow = shows.find((s) => s.id === openId) ?? null

  return (
    <div className="flex gap-4" style={{ height: '64vh' }}>
      <GlassCard className={cn('w-full shrink-0 overflow-y-auto p-2 md:w-72', openId && 'hidden md:block')}>
        {shows.map((show) => {
          const last = lastMessages[show.id]
          return (
            <button
              key={show.id}
              onClick={() => setOpenId(show.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 text-left transition-colors hover:bg-[rgba(127,127,127,0.08)]',
                openId === show.id && 'bg-[rgba(127,127,127,0.10)]'
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                {initials(show.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="body-sm truncate font-semibold text-[var(--ink-1)]">{show.name}</p>
                <p className="truncate text-[12px] text-[var(--ink-3)]">{last ? last.message : 'No messages yet'}</p>
              </div>
              {last && <span className="shrink-0 text-[10px] text-[var(--ink-4)]">{formatDate(last.createdAt)}</span>}
            </button>
          )
        })}
      </GlassCard>

      <div className={cn('flex-1', !openId && 'hidden md:flex')}>
        {openShow ? (
          <ChatThread show={openShow} sessionUser={sessionUser} onBack={() => setOpenId(null)} />
        ) : (
          <GlassCard className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <MessageSquare size={28} className="text-[var(--ink-4)]" />
            <p className="body-sm text-[var(--ink-3)]">Select a group to start chatting.</p>
          </GlassCard>
        )}
      </div>
    </div>
  )
}

function ChatThread({
  show,
  sessionUser,
  onBack,
}: {
  show: Show
  sessionUser: Session['user']
  onBack: () => void
}) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['team-messages', show.id],
    queryFn: async () => {
      const res = await fetch(`/api/team/messages?showId=${show.id}`)
      return res.json()
    },
    initialData: [],
    refetchInterval: 4000,
  })

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      await fetch('/api/team/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: show.id, message: msg }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-messages', show.id] }),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    if (!draft.trim()) return
    sendMutation.mutate(draft)
    setDraft('')
  }

  return (
    <GlassCard className="flex w-full flex-col overflow-hidden p-0">
      <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid var(--line-1)' }}>
        <button onClick={onBack} className="text-[var(--ink-2)] md:hidden" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
          {initials(show.name)}
        </div>
        <p className="body-sm font-semibold text-[var(--ink-1)]">{show.name}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="body-sm py-8 text-center text-[var(--ink-4)]">No messages yet. Say hello 👋</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderEmail === sessionUser.email
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                {initials(msg.sender.fullName ?? msg.senderEmail)}
              </div>
              <div className={`flex max-w-[70%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="rounded-[14px] px-3 py-2" style={isMe ? { background: 'var(--ink-1)', color: 'var(--bg-0)' } : { background: 'var(--bg-2)', color: 'var(--ink-1)' }}>
                  <p className="body-sm">{msg.message}</p>
                </div>
                <p className="body-sm text-[var(--ink-4)]">{formatDate(msg.createdAt)}</p>
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
          placeholder="Message the group…"
          className="flex-1 border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <PillButton size="sm" onClick={handleSend} disabled={!draft.trim()}>
          <Send size={14} />
        </PillButton>
      </div>
    </GlassCard>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import type { Show } from '@prisma/client'
import type { Session } from 'next-auth'
import { GlassCard } from '@/components/common/GlassCard'
import { Input } from '@/components/ui/input'
import { PillButton } from '@/components/common/PillButton'
import { EditShowModal } from '@/components/shows/EditShowModal'
import { initials, formatDate, cn } from '@/lib/utils'
import {
  Send, Crown, UserPlus, X, Link2, CalendarDays, Mail, Clock, Plus, ArrowLeft, MessageSquare,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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
  lastMessages: Record<string, { message: string; createdAt: string } | null>
  sessionUser: Session['user']
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function TeamClient({ shows: initialShows, lastMessages, sessionUser }: Props) {
  const [shows, setShows] = useState(initialShows)
  const [tab, setTab] = useState<'chat' | 'members'>('chat')
  const [selectedShowId, setSelectedShowId] = useState(initialShows[0]?.id ?? '')
  const [createOpen, setCreateOpen] = useState(false)

  const selectedShow = shows.find((s) => s.id === selectedShowId) ?? null

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display-sm text-[var(--ink-1)]">Hub</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full p-1" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}>
            {(['chat', 'members'] as const).map((t) => (
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
          <PillButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Group
          </PillButton>
        </div>
      </div>

      {shows.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="display-sm text-[var(--ink-1)]">No groups yet</p>
          <p className="body mt-2 text-[var(--ink-2)]">Create a group to start collaborating with your team.</p>
          <div className="mt-4 flex justify-center">
            <PillButton onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create your first group
            </PillButton>
          </div>
        </GlassCard>
      ) : tab === 'chat' ? (
        <ChatWhatsApp shows={shows} lastMessages={lastMessages} sessionUser={sessionUser} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {shows.map((show) => (
              <button
                key={show.id}
                onClick={() => setSelectedShowId(show.id)}
                className={cn(
                  'body-sm rounded-full border px-3 py-1.5 font-medium transition-all',
                  selectedShowId === show.id
                    ? 'border-transparent bg-[var(--accent-violet)] text-[var(--bg-0)]'
                    : 'border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                )}
              >
                {show.name}
              </button>
            ))}
          </div>
          {selectedShow && (
            <MembersPanel
              show={selectedShow}
              sessionUser={sessionUser}
              onUpdate={(patch) =>
                setShows((prev) => prev.map((s) => (s.id === selectedShow.id ? { ...s, ...patch } : s)))
              }
            />
          )}
        </>
      )}

      <EditShowModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        show={null}
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
      {/* Contacts / groups list */}
      <GlassCard
        className={cn('w-full shrink-0 overflow-y-auto p-2 md:w-72', openId && 'hidden md:block')}
      >
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
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
              >
                {initials(show.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="body-sm truncate font-semibold text-[var(--ink-1)]">{show.name}</p>
                <p className="truncate text-[12px] text-[var(--ink-3)]">
                  {last ? last.message : 'No messages yet'}
                </p>
              </div>
              {last && (
                <span className="shrink-0 text-[10px] text-[var(--ink-4)]">
                  {formatDate(last.createdAt)}
                </span>
              )}
            </button>
          )
        })}
      </GlassCard>

      {/* Conversation */}
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
      {/* Conversation header */}
      <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid var(--line-1)' }}>
        <button onClick={onBack} className="text-[var(--ink-2)] md:hidden" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
        >
          {initials(show.name)}
        </div>
        <p className="body-sm font-semibold text-[var(--ink-1)]">{show.name}</p>
      </div>

      {/* Messages */}
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

      {/* Input */}
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

/* ---------------- Team builder (Members) ---------------- */

function MembersPanel({
  show,
  sessionUser,
  onUpdate,
}: {
  show: Show
  sessionUser: Session['user']
  onUpdate: (patch: Partial<Show>) => void
}) {
  const [inviteEmail, setInviteEmail] = useState('')
  const members = show.memberEmails ?? []
  const pending = show.pendingInvites ?? []

  async function patchShow(data: Partial<Show>) {
    onUpdate(data)
    try {
      await fetch(`/api/shows/${show.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {
      toast.error('Could not save')
    }
  }

  function invite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    if (email === sessionUser.email || members.includes(email) || pending.includes(email)) {
      toast('Already on this team')
      return
    }
    patchShow({ pendingInvites: [...pending, email] })
    setInviteEmail('')
    toast.success(`Invited ${email}`)
  }

  function copyCalendarLink() {
    navigator.clipboard.writeText(`${window.location.origin}/team-calendar/${sessionUser.id}/${show.id}`)
    toast.success('Calendar link copied')
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <p className="body-sm mb-3 font-semibold text-[var(--ink-1)]">Invite a teammate</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            placeholder="teammate@email.com"
            className="min-w-[200px] flex-1 border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
          />
          <PillButton size="sm" onClick={invite}>
            <UserPlus size={14} /> Invite
          </PillButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copyCalendarLink} className="body-sm flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]" style={{ borderColor: 'var(--line-2)' }}>
            <CalendarDays size={13} /> Share calendar link
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/?signin=1`)
              toast.success('Sign-in link copied')
            }}
            className="body-sm flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            <Link2 size={13} /> Copy app link
          </button>
        </div>
      </GlassCard>

      <div>
        <p className="body-sm mb-2 font-semibold text-[var(--ink-2)]">
          Team · {members.length + 1} member{members.length + 1 !== 1 ? 's' : ''}
        </p>
        <GlassCard className="divide-y p-0" style={{ borderColor: 'var(--line-1)' }}>
          <MemberRow
            email={sessionUser.email}
            label={sessionUser.name ?? sessionUser.email}
            role="Manager"
            roleIcon={<Crown size={13} style={{ color: 'var(--warning)' }} />}
          />
          {members.map((email) => (
            <MemberRow
              key={email}
              email={email}
              label={email}
              role="Member"
              onRemove={() => patchShow({ memberEmails: members.filter((m) => m !== email) })}
            />
          ))}
        </GlassCard>
      </div>

      {pending.length > 0 && (
        <div>
          <p className="body-sm mb-2 font-semibold text-[var(--ink-2)]">Pending invites</p>
          <GlassCard className="divide-y p-0" style={{ borderColor: 'var(--line-1)' }}>
            {pending.map((email) => (
              <div key={email} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Mail size={15} className="text-[var(--ink-3)]" />
                  <span className="body-sm text-[var(--ink-1)]">{email}</span>
                  <span className="flex items-center gap-1 text-[11px] text-[var(--ink-4)]">
                    <Clock size={11} /> pending
                  </span>
                </div>
                <button
                  onClick={() => patchShow({ pendingInvites: pending.filter((p) => p !== email) })}
                  className="text-[var(--ink-4)] transition-colors hover:text-[var(--error)]"
                  aria-label="Cancel invite"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </GlassCard>
        </div>
      )}
    </div>
  )
}

function MemberRow({
  email,
  label,
  role,
  roleIcon,
  onRemove,
}: {
  email: string
  label: string
  role: string
  roleIcon?: React.ReactNode
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
          {initials(label)}
        </div>
        <div className="min-w-0">
          <p className="body-sm truncate font-medium text-[var(--ink-1)]">{label}</p>
          <p className="truncate text-[11px] text-[var(--ink-3)]">{email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-3)]" style={{ background: 'var(--bg-3)' }}>
          {roleIcon} {role}
        </span>
        {onRemove && (
          <button onClick={onRemove} className="text-[var(--ink-4)] transition-colors hover:text-[var(--error)]" aria-label="Remove">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

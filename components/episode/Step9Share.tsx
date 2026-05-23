'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Input } from '@/components/ui/input'
import { ArrowRight, Link2, Mail, Copy, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  episode: Episode | null; show: Show | null; shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>; userEmail: string
}

export function Step9Share({ episode, onNext }: Props) {
  const briefUrl = episode?.briefUrl ?? (episode?.id ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/brief/${episode.id}` : '')
  const [guestEmail, setGuestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(briefUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendEmail() {
    if (!guestEmail || !episode?.id) return
    setSending(true)
    try {
      const res = await fetch('/api/email/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeId: episode.id, guestEmail }) })
      if (res.ok) { toast.success('Brief sent!'); setGuestEmail('') }
      else toast.error('Failed to send')
    } catch { toast.error('Failed to send') } finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 9 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Share with your guest</h2>
        <p className="body mt-1 text-[var(--ink-2)]">Send a public brief link so your guest knows what to expect.</p>
      </div>

      <GlassCard className="p-6 space-y-4">
        <div>
          <p className="body-sm mb-2 text-[var(--ink-2)]">Guest brief link</p>
          <div className="flex gap-2">
            <Input value={briefUrl} readOnly className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1 font-mono text-sm" />
            <PillButton variant="secondary" size="sm" onClick={copyLink}>
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            </PillButton>
          </div>
        </div>

        <div className="hairline" />

        <div>
          <p className="body-sm mb-2 text-[var(--ink-2)]">Send via email</p>
          <div className="flex gap-2">
            <Input
              type="email"
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] flex-1 placeholder:text-[var(--ink-4)]"
              onKeyDown={e => e.key === 'Enter' && sendEmail()}
            />
            <PillButton size="sm" onClick={sendEmail} disabled={sending || !guestEmail}>
              <Mail size={14} /> {sending ? 'Sending…' : 'Send'}
            </PillButton>
          </div>
        </div>
      </GlassCard>

      <div className="flex gap-3">
        <PillButton onClick={() => onNext({ briefUrl, status: 'approved' })}>
          Next <ArrowRight size={14} />
        </PillButton>
        <PillButton variant="secondary" onClick={() => onNext({ briefUrl })}>Skip</PillButton>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Send, Trash2, Pencil, Check, Sparkles, Wand2, TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'

const nf = new Intl.NumberFormat('en-US')
import { useConfirm } from '@/components/common/ConfirmDialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Audience = 'FREE' | 'SOLO' | 'MASTER' | 'ALL'

const AUDIENCE_LABEL: Record<Audience, string> = {
  FREE: 'Free plan',
  SOLO: 'Studio Solo',
  MASTER: 'Master',
  ALL: 'All users',
}

interface Campaign {
  id: string
  subject: string
  preheader: string | null
  html: string
  status: 'DRAFT' | 'SENT'
  audience: Audience
  needsReview: boolean
  sentAt: string | null
  sentCount: number
  createdByEmail: string
  createdAt: string
  updatedAt: string
}

interface Props {
  campaigns: Campaign[]
  recipientCounts: Record<Audience, number>
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Compact traffic summary for the marketing page: live visitors now (GA4
// Realtime, polled), last-7d sessions, and the top source. Links to the full
// SEO & Traffic dashboard. Degrades to dashes if GA4 isn't connected.
function TrafficGlance() {
  const [rt, setRt] = useState<number | null>(null)
  const [sessions7, setSessions7] = useState<number | null>(null)
  const [topSource, setTopSource] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    let alive = true
    async function loadRt() {
      try {
        const j = await fetch('/api/admin/seo/realtime', { cache: 'no-store' }).then((x) => x.json())
        if (alive && typeof j?.activeUsers === 'number') setRt(j.activeUsers)
      } catch { /* ignore */ }
    }
    async function loadGa() {
      try {
        const j = await fetch('/api/admin/seo/analytics?range=7d', { cache: 'no-store' }).then((x) => x.json())
        if (!alive) return
        if (j?.error) { setConnected(false); return }
        setSessions7((j.sessions ?? []).reduce((s: number, d: { sessions: number }) => s + d.sessions, 0))
        setTopSource(j.sources?.[0]?.sourceMedium ?? null)
      } catch { /* ignore */ }
    }
    loadRt(); loadGa()
    const id = setInterval(loadRt, 30_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <GlassCard className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} style={{ color: 'var(--accent-violet)' }} />
        <p className="body font-semibold text-[var(--ink-1)]">Traffic</p>
      </div>
      <TrafficStat label="Visitors now" value={rt == null ? '…' : nf.format(rt)} live />
      <TrafficStat label="Sessions (7d)" value={!connected ? '—' : sessions7 == null ? '…' : nf.format(sessions7)} />
      <TrafficStat label="Top source (7d)" value={!connected ? '—' : topSource ?? '…'} />
      <Link href="/admin/seo" className="ml-auto body-sm font-semibold text-[var(--accent-violet)] hover:underline">
        Full dashboard →
      </Link>
    </GlassCard>
  )
}

function TrafficStat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {live && <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />}
        <p className="body-sm text-[var(--ink-3)]">{label}</p>
      </div>
      <p className="display-sm max-w-[220px] truncate leading-tight text-[var(--ink-1)]" title={value}>{value}</p>
    </div>
  )
}

export function MarketingEmailsClient({ campaigns, recipientCounts }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null)
  const [generating, setGenerating] = useState(false)

  async function generateNow() {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/marketing-emails/generate', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not generate drafts')
        return
      }
      const ok = (data.results ?? []).filter((r: { campaignId?: string }) => r.campaignId).length
      const failed = (data.results ?? []).length - ok
      if (ok > 0) {
        toast.success(
          failed > 0
            ? `Generated ${ok} draft${ok === 1 ? '' : 's'} (${failed} failed). Awaiting review.`
            : `Generated ${ok} draft${ok === 1 ? '' : 's'}. Awaiting review.`,
        )
      } else {
        toast.error('No drafts produced. Check the logs.')
      }
      router.refresh()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display-sm text-[var(--ink-1)]">Marketing emails</h1>
          <p className="body mt-1 text-[var(--ink-2)]">
            Write campaigns and queue them up. The cron job sends the oldest DRAFT every Monday,
            Wednesday, and Friday at 10am ET, to the audience you pick. After every send a new
            AI draft is auto-generated for the same audience, so the queue stays one week ahead.
          </p>
        </div>
        <div className="flex gap-2">
          <PillButton variant="secondary" onClick={generateNow} disabled={generating}>
            <Wand2 size={14} /> {generating ? 'Generating...' : 'Generate now'}
          </PillButton>
          <PillButton onClick={() => setEditing('new')}>
            <Plus size={14} /> New campaign
          </PillButton>
        </div>
      </div>

      {/* Live audience sizes (opt-ins only). Helps decide a campaign's target. */}
      <div className="grid gap-3 sm:grid-cols-4">
        {(['FREE', 'SOLO', 'MASTER', 'ALL'] as Audience[]).map((aud) => (
          <div
            key={aud}
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
          >
            <p className="eyebrow text-[var(--ink-3)]">{AUDIENCE_LABEL[aud]}</p>
            <p className="display-sm mt-1 text-[var(--ink-1)]">{recipientCounts[aud]}</p>
            <p className="body-sm text-[var(--ink-3)]">opted-in users</p>
          </div>
        ))}
      </div>

      {/* Traffic at a glance (GA4). Links through to the full SEO & Traffic dashboard. */}
      <TrafficGlance />

      <GlassCard className="overflow-hidden">
        <table className="w-full text-left">
          <thead className="body-sm" style={{ background: 'var(--bg-2)', color: 'var(--ink-3)' }}>
            <tr>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold">Audience</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Sent</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="body-sm">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  No campaigns yet. Click <strong>New campaign</strong> to write the first one.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--line-1)' }}>
                  <td className="px-4 py-3 text-[var(--ink-1)]">
                    <div className="font-semibold">{c.subject}</div>
                    {c.preheader && (
                      <div className="body-sm text-[var(--ink-3)]">{c.preheader}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: 'color-mix(in srgb, var(--ink-2) 14%, transparent)',
                        color: 'var(--ink-1)',
                      }}
                    >
                      {AUDIENCE_LABEL[c.audience]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.needsReview ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: 'color-mix(in srgb, var(--warning) 22%, transparent)',
                          color: 'var(--warning)',
                        }}
                      >
                        <Sparkles size={11} /> AI, awaiting review
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background:
                            c.status === 'SENT'
                              ? 'color-mix(in srgb, var(--accent-cyan) 18%, transparent)'
                              : 'color-mix(in srgb, var(--accent-violet) 18%, transparent)',
                          color: c.status === 'SENT' ? 'var(--accent-cyan)' : 'var(--accent-violet)',
                        }}
                      >
                        {c.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-[var(--ink-2)]">
                    {c.status === 'SENT' ? `${c.sentCount} at ${formatDate(c.sentAt)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'DRAFT' ? (
                      <div className="flex justify-end gap-2">
                        {c.needsReview && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/admin/marketing-emails/${c.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ needsReview: false }),
                              })
                              if (!res.ok) {
                                const d = await res.json().catch(() => ({}))
                                toast.error(d.error ?? 'Could not approve')
                                return
                              }
                              toast.success('Approved. Will go out at the next send window.')
                              router.refresh()
                            }}
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ background: 'var(--success)', color: 'var(--bg-0)' }}
                            aria-label="Approve"
                          >
                            <Check size={12} /> Approve
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(c)}
                          className="rounded-full p-2 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
                          aria-label="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete campaign?',
                              message: 'This campaign will be removed from the queue.',
                              confirmLabel: 'Delete',
                              cancelLabel: 'Keep',
                              destructive: true,
                            })
                            if (!ok) return
                            const res = await fetch(`/api/admin/marketing-emails/${c.id}`, { method: 'DELETE' })
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}))
                              toast.error(d.error ?? 'Could not delete')
                              return
                            }
                            toast.success('Deleted')
                            router.refresh()
                          }}
                          className="rounded-full p-2 text-[var(--ink-3)] hover:text-[var(--error)]"
                          aria-label="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="body-sm text-[var(--ink-3)]">,</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>

      <EditCampaignDialog
        open={!!editing}
        campaign={editing && editing !== 'new' ? editing : null}
        recipientCounts={recipientCounts}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); router.refresh() }}
      />
    </div>
  )
}

// New/edit dialog. Posts to the admin API and refreshes the list.
function EditCampaignDialog({
  open, campaign, recipientCounts, onClose, onSaved,
}: {
  open: boolean
  campaign: Campaign | null
  recipientCounts: Record<Audience, number>
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!campaign
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [html, setHtml] = useState('')
  const [audience, setAudience] = useState<Audience>('FREE')
  const [busy, setBusy] = useState(false)

  // Re-seed the form whenever the dialog opens for a new/different campaign so
  // editing an existing one shows its current values and "New campaign" starts
  // from a blank slate.
  useEffect(() => {
    if (!open) return
    setSubject(campaign?.subject ?? '')
    setPreheader(campaign?.preheader ?? '')
    setHtml(campaign?.html ?? '')
    setAudience(campaign?.audience ?? 'FREE')
  }, [open, campaign])

  async function save() {
    if (!subject.trim() || !html.trim()) {
      toast.error('Subject and body are required')
      return
    }
    setBusy(true)
    try {
      const url = isEdit ? `/api/admin/marketing-emails/${campaign!.id}` : '/api/admin/marketing-emails'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, preheader: preheader || null, html, audience }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save')
        return
      }
      toast.success(isEdit ? 'Updated' : 'Queued')
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="max-w-2xl border-[var(--line-1)]"
        style={{ background: 'var(--bg-2)' }}
      >
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {isEdit ? 'Edit campaign' : 'New campaign'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="body-sm text-[var(--ink-2)]">Audience</Label>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['FREE', 'SOLO', 'MASTER', 'ALL'] as Audience[]).map((aud) => {
                const active = audience === aud
                return (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setAudience(aud)}
                    className="rounded-xl px-3 py-2 text-left transition-colors"
                    style={{
                      background: active ? 'var(--ink-1)' : 'var(--bg-3)',
                      color: active ? 'var(--bg-0)' : 'var(--ink-2)',
                      border: '1px solid var(--line-2)',
                    }}
                  >
                    <div className="body-sm font-semibold">{AUDIENCE_LABEL[aud]}</div>
                    <div className="text-xs opacity-80">{recipientCounts[aud]} people</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="body-sm text-[var(--ink-2)]">Subject line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="The one tip our top hosts use"
              className="mt-1 border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)]"
            />
          </div>
          <div>
            <Label className="body-sm text-[var(--ink-2)]">Inbox preview (preheader)</Label>
            <Input
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              placeholder="Optional. Shown next to the subject in most inboxes."
              className="mt-1 border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)]"
            />
          </div>
          <div>
            <Label className="body-sm text-[var(--ink-2)]">
              Body (HTML allowed: &lt;p&gt;, &lt;a&gt;, &lt;strong&gt;, &lt;ul&gt;, etc.)
            </Label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={14}
              placeholder={'<p>Hi {firstName},</p>\n<p>This week we shipped...</p>'}
              className="mt-1 w-full rounded-md border bg-[var(--bg-3)] p-3 font-mono text-sm text-[var(--ink-1)]"
              style={{ borderColor: 'var(--line-2)' }}
            />
            <p className="body-sm mt-1 text-[var(--ink-3)]">
              The branded shell and unsubscribe footer are added automatically.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <PillButton variant="secondary" onClick={onClose} disabled={busy}>Cancel</PillButton>
            <PillButton onClick={save} disabled={busy}>
              <Send size={14} /> {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Queue campaign'}
            </PillButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

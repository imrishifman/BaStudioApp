'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { Users, DollarSign, TrendingUp, Link, Mail, CheckCircle2, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Influencer, InfluencerConversion, PayoutLog } from '@prisma/client'

type ConversionWithInfluencer = InfluencerConversion & { influencer: { name: string } }

interface Props {
  influencers: Influencer[]
  conversions: ConversionWithInfluencer[]
  payouts: PayoutLog[]
}

type Tab = 'influencers' | 'conversions' | 'payouts'

export function InfluencersAdminClient({ influencers: initial, conversions, payouts }: Props) {
  const [tab, setTab] = useState<Tab>('influencers')
  const [influencers, setInfluencers] = useState(initial)
  const [form, setForm] = useState({ name: '', email: '', handle: '', couponCode: '', commissionValue: 20 })
  const [creating, setCreating] = useState(false)

  async function createInfluencer() {
    if (!form.name || !form.email) return
    setCreating(true)
    const res = await fetch('/api/influencers/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const json = await res.json()
      // Server returns the influencer plus { email: {sent, ...} }.
      const inf = json as Influencer & { email?: { sent: boolean; reason?: string } }
      setInfluencers(prev => [inf, ...prev])
      setForm({ name: '', email: '', handle: '', couponCode: '', commissionValue: 20 })
      if (inf.email?.sent) toast.success('Influencer created and invite emailed')
      else toast.success('Influencer created (email not sent: ' + (inf.email?.reason ?? 'unknown') + ')')
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Could not create influencer')
    }
    setCreating(false)
  }

  function copyInviteLink(token: string) {
    // Same URL the email uses, so admins can hand-deliver if Resend fails.
    const url = `${window.location.origin}/influencer-agreement?token=${token}`
    navigator.clipboard.writeText(url)
    toast.success('Invite link copied')
  }

  async function resendInvite(id: string) {
    const res = await fetch('/api/influencers/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resend: true, influencerId: id }),
    })
    const data = await res.json()
    if (res.ok && data?.email?.sent) toast.success('Invite re-sent')
    else if (res.ok) toast.error('Sent but email failed: ' + (data?.email?.reason ?? 'unknown'))
    else toast.error(data.error ?? 'Could not re-send')
  }

  // Edit drawer state. `editing` is the influencer being edited, or null.
  const [editing, setEditing] = useState<Influencer | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string; handle: string; couponCode: string; commissionValue: string; status: string }>({
    name: '', email: '', handle: '', couponCode: '', commissionValue: '', status: 'active',
  })
  const [saving, setSaving] = useState(false)

  function openEdit(inf: Influencer) {
    setEditForm({
      name: inf.name ?? '',
      email: inf.email ?? '',
      handle: inf.handle ?? '',
      couponCode: inf.couponCode ?? '',
      commissionValue: String(inf.commissionValue ?? ''),
      status: inf.status ?? 'active',
    })
    setEditing(inf)
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/influencers/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        email: editForm.email,
        handle: editForm.handle || null,
        couponCode: editForm.couponCode || null,
        commissionValue: editForm.commissionValue ? Number(editForm.commissionValue) : null,
        status: editForm.status,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Update failed')
      setSaving(false)
      return
    }
    setInfluencers(prev => prev.map(i => i.id === editing.id ? data : i))
    toast.success('Saved')
    setEditing(null)
    setSaving(false)
  }

  async function deleteInfluencer(inf: Influencer) {
    if (!confirm(`Delete ${inf.name}? This permanently removes the influencer plus all their conversions and payout records. This cannot be undone.`)) return
    const res = await fetch(`/api/influencers/${inf.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInfluencers(prev => prev.filter(i => i.id !== inf.id))
      toast.success(`Deleted ${inf.name}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Delete failed')
    }
  }

  const TABS = [
    { key: 'influencers' as Tab, label: 'Influencers', icon: Users },
    { key: 'conversions' as Tab, label: 'Conversions', icon: TrendingUp },
    { key: 'payouts' as Tab, label: 'Payouts', icon: DollarSign },
  ]

  return (
    <div className="p-6 lg:p-8">
      <h1 className="display-sm text-[var(--ink-1)] mb-6">Influencer Portal</h1>

      <div className="mb-6 flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)', width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
              style={tab === t.key ? { background: 'var(--bg-3)', color: 'var(--ink-1)' } : { color: 'var(--ink-3)' }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'influencers' && (
        <div className="space-y-4">
          <GlassCard className="p-4">
            <p className="body-sm font-semibold text-[var(--ink-1)] mb-3">Add influencer</p>
            <div className="flex flex-wrap gap-2 items-end">
              {[
                { label: 'Name', key: 'name', placeholder: 'Jane Doe' },
                { label: 'Email', key: 'email', placeholder: 'jane@example.com' },
                { label: 'Handle', key: 'handle', placeholder: '@janedoe' },
                { label: 'Coupon code', key: 'couponCode', placeholder: 'JANE20' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="body-sm text-[var(--ink-3)]">{f.label}</label>
                  <Input
                    value={(form as Record<string, string | number>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-36 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Commission %</label>
                <Input
                  type="number"
                  value={form.commissionValue}
                  onChange={e => setForm(prev => ({ ...prev, commissionValue: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <PillButton size="sm" onClick={createInfluencer} disabled={creating || !form.name || !form.email}>
                Add
              </PillButton>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            {influencers.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">No influencers yet.</p>}
            <div className="divide-y">
              {influencers.map(inf => (
                <div key={inf.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="body-sm font-medium text-[var(--ink-1)]">{inf.name}</p>
                    <p className="body-sm text-[var(--ink-3)]">
                      {inf.email} · {inf.commissionValue}%
                      {inf.couponCode && <> · <span className="font-mono">{inf.couponCode}</span></>}
                    </p>
                  </div>
                  {inf.agreementSigned ? (
                    <span className="flex items-center gap-1 body-sm" style={{ color: 'var(--success)' }}>
                      <CheckCircle2 size={12} /> Signed
                    </span>
                  ) : (
                    <span className="body-sm text-[var(--ink-4)]">Pending signature</span>
                  )}
                  <button
                    onClick={() => resendInvite(inf.id)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title="Re-send invite email"
                  >
                    <Mail size={12} /> Re-send
                  </button>
                  <button
                    onClick={() => copyInviteLink(inf.agreementSignatureToken ?? '')}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title="Copy invite URL to clipboard"
                  >
                    <Link size={12} /> Copy link
                  </button>
                  <button
                    onClick={() => openEdit(inf)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title="Edit influencer"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => deleteInfluencer(inf)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] transition-colors hover:text-[var(--error)]"
                    title="Delete influencer permanently"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === 'conversions' && (
        <GlassCard className="overflow-hidden p-0">
          {conversions.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">No conversions yet.</p>}
          <div className="divide-y">
            {conversions.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-[var(--ink-1)]">{c.influencer.name}</p>
                  <p className="body-sm text-[var(--ink-3)]">{c.convertedUserEmail ?? 'anonymous'} · ${(c.commissionEarned ?? 0).toFixed(2)}</p>
                </div>
                <span
                  className="body-sm rounded-full px-2 py-0.5"
                  style={{ background: c.commissionPaid ? 'rgba(74,222,128,0.15)' : 'var(--bg-3)', color: c.commissionPaid ? '#4ade80' : 'var(--ink-3)' }}
                >
                  {c.commissionPaid ? 'Paid' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'payouts' && (
        <GlassCard className="overflow-hidden p-0">
          {payouts.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">No payouts yet.</p>}
          <div className="divide-y">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-[var(--ink-1)]">${(p.amountUsd ?? 0).toFixed(2)}</p>
                  <p className="body-sm text-[var(--ink-3)]">{new Date(p.payoutDate).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Edit drawer */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-[var(--radius-md)] sm:rounded-[var(--radius-md)]"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--line-1)' }}>
              <h2 className="body font-semibold text-[var(--ink-1)]">Edit {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-[var(--ink-3)] hover:text-[var(--ink-1)]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Name</label>
                <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Email</label>
                <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Handle</label>
                <Input value={editForm.handle} onChange={e => setEditForm(p => ({ ...p, handle: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Coupon code</label>
                <Input
                  value={editForm.couponCode}
                  onChange={e => setEditForm(p => ({ ...p, couponCode: e.target.value.toUpperCase() }))}
                  className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Commission %</label>
                <Input
                  type="number"
                  value={editForm.commissionValue}
                  onChange={e => setEditForm(p => ({ ...p, commissionValue: e.target.value }))}
                  className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">Status</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="h-9 w-full rounded-md px-3 body-sm"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5" style={{ borderTop: '1px solid var(--line-1)' }}>
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="body-sm rounded-full border px-4 py-1.5 text-[var(--ink-2)] disabled:opacity-50"
                style={{ borderColor: 'var(--line-2)' }}
              >
                Cancel
              </button>
              <PillButton size="sm" onClick={saveEdit} disabled={saving || !editForm.name || !editForm.email}>
                {saving ? 'Saving…' : 'Save changes'}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

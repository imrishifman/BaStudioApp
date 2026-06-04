'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { useConfirm } from '@/components/common/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Users, DollarSign, TrendingUp, Link, Mail, CheckCircle2, Pencil, Trash2, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { Influencer, InfluencerConversion, PayoutLog } from '@prisma/client'
import { useT } from '@/components/i18n/I18nProvider'

type ConversionWithInfluencer = InfluencerConversion & { influencer: { name: string } }

interface Props {
  influencers: Influencer[]
  conversions: ConversionWithInfluencer[]
  payouts: PayoutLog[]
}

type Tab = 'influencers' | 'conversions' | 'payouts'

export function InfluencersAdminClient({ influencers: initial, conversions, payouts }: Props) {
  const t = useT()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('influencers')
  const [influencers, setInfluencers] = useState(initial)
  const [form, setForm] = useState({ name: '', email: '', handle: '', couponCode: '', commissionValue: 20, customerDiscount: 0 })
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
      setForm({ name: '', email: '', handle: '', couponCode: '', commissionValue: 20, customerDiscount: 0 })
      if (inf.email?.sent) toast.success(t('adminInf.createdEmailed'))
      else toast.success(t('adminInf.createdNoEmailPrefix') + (inf.email?.reason ?? t('adminInf.unknown')) + t('adminInf.createdNoEmailSuffix'))
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? t('adminInf.couldNotCreate'))
    }
    setCreating(false)
  }

  function copyInviteLink(token: string) {
    // Same URL the email uses, so admins can hand-deliver if Resend fails.
    const url = `${window.location.origin}/influencer-agreement?token=${token}`
    navigator.clipboard.writeText(url)
    toast.success(t('adminInf.inviteLinkCopied'))
  }

  async function resendInvite(id: string) {
    const res = await fetch('/api/influencers/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resend: true, influencerId: id }),
    })
    const data = await res.json()
    if (res.ok && data?.email?.sent) toast.success(t('adminInf.inviteResent'))
    else if (res.ok) toast.error(t('adminInf.sentEmailFailedPrefix') + (data?.email?.reason ?? t('adminInf.unknown')))
    else toast.error(data.error ?? t('adminInf.couldNotResend'))
  }

  // Edit drawer state. `editing` is the influencer being edited, or null.
  const [editing, setEditing] = useState<Influencer | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string; handle: string; couponCode: string; commissionValue: string; customerDiscount: string; status: string }>({
    name: '', email: '', handle: '', couponCode: '', commissionValue: '', customerDiscount: '', status: 'active',
  })
  const [saving, setSaving] = useState(false)

  function openEdit(inf: Influencer) {
    setEditForm({
      name: inf.name ?? '',
      email: inf.email ?? '',
      handle: inf.handle ?? '',
      couponCode: inf.couponCode ?? '',
      commissionValue: String(inf.commissionValue ?? ''),
      customerDiscount: inf.customerDiscount != null ? String(inf.customerDiscount) : '',
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
        customerDiscount: editForm.customerDiscount ? Number(editForm.customerDiscount) : null,
        status: editForm.status,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? t('adminInf.updateFailed'))
      setSaving(false)
      return
    }
    setInfluencers(prev => prev.map(i => i.id === editing.id ? data : i))
    toast.success(t('adminInf.saved'))
    setEditing(null)
    setSaving(false)
  }

  // Re-mint the influencer's Stripe promo in this environment's Stripe mode and
  // reconcile its active flag with their signed status. Fixes codes that read
  // "invalid" at checkout (created against a different Stripe key) or that never
  // got switched on after signing.
  const [resyncingId, setResyncingId] = useState<string | null>(null)
  async function resyncInfluencer(inf: Influencer) {
    if (!inf.couponCode || !inf.customerDiscount) {
      toast.error(t('adminInf.addCouponDiscountFirst'))
      return
    }
    setResyncingId(inf.id)
    const res = await fetch(`/api/influencers/${inf.id}/resync`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setInfluencers(prev => prev.map(i => (i.id === inf.id ? data : i)))
      const mode = data.liveMode ? 'live' : 'test'
      const state = data.active ? t('adminInf.stateActive') : t('adminInf.stateInactive')
      toast.success(data.recreated ? `${t('adminInf.recreatedIn')} ${mode} ${t('adminInf.mode')}: ${state}` : `${t('adminInf.inSync')} (${mode} ${t('adminInf.mode')}): ${state}`)
    } else {
      toast.error(data.error ?? t('adminInf.resyncFailed'))
    }
    setResyncingId(null)
  }

  async function deleteInfluencer(inf: Influencer) {
    const ok = await confirm({
      title: `${t('adminInf.deleteConfirmTitlePrefix')}${inf.name}${t('adminInf.deleteConfirmTitleSuffix')}`,
      message: t('adminInf.deleteConfirmMsg'),
      confirmLabel: t('adminInf.delete'),
      destructive: true,
    })
    if (!ok) return
    const res = await fetch(`/api/influencers/${inf.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInfluencers(prev => prev.filter(i => i.id !== inf.id))
      toast.success(`${t('adminInf.deletedPrefix')}${inf.name}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('adminInf.deleteFailed'))
    }
  }

  // Unpaid commission owed per influencer, summed from their conversions.
  const unpaidByInfluencer = conversions.reduce<Record<string, number>>((acc, c) => {
    if (!c.commissionPaid && c.commissionEarned) {
      acc[c.influencerId] = +(((acc[c.influencerId] ?? 0) + c.commissionEarned)).toFixed(2)
    }
    return acc
  }, {})

  const [payingId, setPayingId] = useState<string | null>(null)
  async function payoutInfluencer(inf: Influencer) {
    const owed = unpaidByInfluencer[inf.id] ?? 0
    const ok = await confirm({
      title: `${t('adminInf.payConfirmTitlePrefix')}${inf.name}${t('adminInf.payConfirmTitleSuffix')}`,
      message: `${t('adminInf.payConfirmMsgPrefix')}${owed.toFixed(2)}${t('adminInf.payConfirmMsgMid')}${inf.name}${t('adminInf.payConfirmMsgSuffix')}`,
      confirmLabel: `${t('adminInf.sendDollarPrefix')}${owed.toFixed(2)}`,
    })
    if (!ok) return
    setPayingId(inf.id)
    const res = await fetch(`/api/influencers/${inf.id}/payout`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`${t('adminInf.paidPrefix')}${inf.name} $${(data.amount ?? owed).toFixed(2)}`)
    } else {
      toast.error(data.error ?? t('adminInf.payoutFailed'))
    }
    setPayingId(null)
  }

  const TABS = [
    { key: 'influencers' as Tab, label: t('adminInf.tabInfluencers'), icon: Users },
    { key: 'conversions' as Tab, label: t('adminInf.tabConversions'), icon: TrendingUp },
    { key: 'payouts' as Tab, label: t('adminInf.tabPayouts'), icon: DollarSign },
  ]

  return (
    <div className="p-6 lg:p-8">
      <h1 className="display-sm text-[var(--ink-1)] mb-6">{t('adminInf.title')}</h1>

      <div className="mb-6 flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--bg-2)', width: 'fit-content' }}>
        {TABS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 body-sm transition-colors"
              style={tab === item.key ? { background: 'var(--bg-3)', color: 'var(--ink-1)' } : { color: 'var(--ink-3)' }}
            >
              <Icon size={14} /> {item.label}
            </button>
          )
        })}
      </div>

      {tab === 'influencers' && (
        <div className="space-y-4">
          <GlassCard className="p-4">
            <p className="body-sm font-semibold text-[var(--ink-1)] mb-3">{t('adminInf.addInfluencer')}</p>
            <div className="flex flex-wrap gap-2 items-end">
              {[
                { label: t('adminInf.name'), key: 'name', placeholder: 'Jane Doe' },
                { label: t('adminInf.email'), key: 'email', placeholder: 'jane@example.com' },
                { label: t('adminInf.handle'), key: 'handle', placeholder: '@janedoe' },
                { label: t('adminInf.couponCode'), key: 'couponCode', placeholder: 'JANE20' },
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
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.commissionPct')}</label>
                <Input
                  type="number"
                  value={form.commissionValue}
                  onChange={e => setForm(prev => ({ ...prev, commissionValue: Number(e.target.value) }))}
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.customerDiscountPct')}</label>
                <Input
                  type="number"
                  value={form.customerDiscount}
                  onChange={e => setForm(prev => ({ ...prev, customerDiscount: Number(e.target.value) }))}
                  placeholder="0"
                  className="w-20 bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <PillButton size="sm" onClick={createInfluencer} disabled={creating || !form.name || !form.email}>
                {t('adminInf.add')}
              </PillButton>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden p-0">
            {influencers.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">{t('adminInf.noInfluencers')}</p>}
            <div className="divide-y">
              {influencers.map(inf => (
                <div key={inf.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="body-sm font-medium text-[var(--ink-1)]">{inf.name}</p>
                    <p className="body-sm text-[var(--ink-3)]">
                      {inf.email} · {inf.commissionValue}{t('adminInf.commissionSuffix')}
                      {inf.couponCode && <> · <span className="font-mono">{inf.couponCode}</span></>}
                      {inf.customerDiscount ? <> · {inf.customerDiscount}{t('adminInf.offSuffix')}</> : null}
                    </p>
                  </div>
                  {inf.agreementSigned ? (
                    <span className="flex items-center gap-1 body-sm" style={{ color: 'var(--success)' }}>
                      <CheckCircle2 size={12} /> {t('adminInf.signed')}
                    </span>
                  ) : (
                    <span className="body-sm text-[var(--ink-4)]">{t('adminInf.pendingSignature')}</span>
                  )}
                  <button
                    onClick={() => resendInvite(inf.id)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title={t('adminInf.titleResend')}
                  >
                    <Mail size={12} /> {t('adminInf.resend')}
                  </button>
                  <button
                    onClick={() => copyInviteLink(inf.agreementSignatureToken ?? '')}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title={t('adminInf.titleCopyLink')}
                  >
                    <Link size={12} /> {t('adminInf.copyLink')}
                  </button>
                  {inf.couponCode && inf.customerDiscount ? (
                    <button
                      onClick={() => resyncInfluencer(inf)}
                      disabled={resyncingId === inf.id}
                      className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors disabled:opacity-50"
                      title={t('adminInf.titleResync')}
                    >
                      <RefreshCw size={12} className={resyncingId === inf.id ? 'animate-spin' : ''} /> {t('adminInf.resync')}
                    </button>
                  ) : null}
                  {inf.stripeOnboardingCompleted && (unpaidByInfluencer[inf.id] ?? 0) > 0 ? (
                    <button
                      onClick={() => payoutInfluencer(inf)}
                      disabled={payingId === inf.id}
                      className="flex items-center gap-1.5 body-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ color: 'var(--success)' }}
                      title={t('adminInf.titlePay')}
                    >
                      <DollarSign size={12} /> {payingId === inf.id ? t('adminInf.sending') : `${t('adminInf.payPrefix')}${(unpaidByInfluencer[inf.id] ?? 0).toFixed(2)}`}
                    </button>
                  ) : null}
                  <button
                    onClick={() => openEdit(inf)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                    title={t('adminInf.titleEdit')}
                  >
                    <Pencil size={12} /> {t('adminInf.edit')}
                  </button>
                  <button
                    onClick={() => deleteInfluencer(inf)}
                    className="flex items-center gap-1.5 body-sm text-[var(--ink-3)] transition-colors hover:text-[var(--error)]"
                    title={t('adminInf.titleDelete')}
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
          {conversions.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">{t('adminInf.noConversions')}</p>}
          <div className="divide-y">
            {conversions.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="body-sm font-medium text-[var(--ink-1)]">{c.influencer.name}</p>
                  <p className="body-sm text-[var(--ink-3)]">{c.convertedUserEmail ?? t('adminInf.anonymousLc')} · ${(c.commissionEarned ?? 0).toFixed(2)}</p>
                </div>
                <span
                  className="body-sm rounded-full px-2 py-0.5"
                  style={{ background: c.commissionPaid ? 'rgba(74,222,128,0.15)' : 'var(--bg-3)', color: c.commissionPaid ? '#4ade80' : 'var(--ink-3)' }}
                >
                  {c.commissionPaid ? t('adminInf.paid') : t('adminInf.pending')}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'payouts' && (
        <GlassCard className="overflow-hidden p-0">
          {payouts.length === 0 && <p className="p-4 body-sm text-[var(--ink-3)]">{t('adminInf.noPayouts')}</p>}
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
              <h2 className="body font-semibold text-[var(--ink-1)]">{t('adminInf.editPrefix')}{editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-[var(--ink-3)] hover:text-[var(--ink-1)]" aria-label={t('adminInf.close')}>
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.name')}</label>
                <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.email')}</label>
                <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.handle')}</label>
                <Input value={editForm.handle} onChange={e => setEditForm(p => ({ ...p, handle: e.target.value }))} className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]" />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.couponCode')}</label>
                <Input
                  value={editForm.couponCode}
                  onChange={e => setEditForm(p => ({ ...p, couponCode: e.target.value.toUpperCase() }))}
                  className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.commissionPct')}</label>
                <Input
                  type="number"
                  value={editForm.commissionValue}
                  onChange={e => setEditForm(p => ({ ...p, commissionValue: e.target.value }))}
                  className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.customerDiscountPct')}</label>
                <Input
                  type="number"
                  value={editForm.customerDiscount}
                  onChange={e => setEditForm(p => ({ ...p, customerDiscount: e.target.value }))}
                  placeholder="0"
                  className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)]"
                />
              </div>
              <div className="space-y-1">
                <label className="body-sm text-[var(--ink-3)]">{t('adminInf.status')}</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="h-9 w-full rounded-md px-3 body-sm"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
                >
                  <option value="pending">{t('adminInf.statusPending')}</option>
                  <option value="active">{t('adminInf.statusActive')}</option>
                  <option value="paused">{t('adminInf.statusPaused')}</option>
                  <option value="disabled">{t('adminInf.statusDisabled')}</option>
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
                {t('adminInf.cancel')}
              </button>
              <PillButton size="sm" onClick={saveEdit} disabled={saving || !editForm.name || !editForm.email}>
                {saving ? t('adminInf.saving') : t('adminInf.saveChanges')}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

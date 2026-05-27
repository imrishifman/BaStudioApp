'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import type { User } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { PlanBadge } from '@/components/common/PlanBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { ArrowRight, MessageSquare } from 'lucide-react'

interface Props { user: User }

export function AccountClient({ user }: Props) {
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [hostName, setHostName] = useState(user.hostName ?? '')
  const [saving, setSaving] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  const inputCls = 'bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]'
  const labelCls = 'body-sm text-[var(--ink-2)]'

  async function saveProfile() {
    setSaving(true)
    const res = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, hostName }) })
    if (res.ok) toast.success('Profile saved')
    else toast.error('Failed to save')
    setSaving(false)
  }

  async function applyCoupon() {
    if (!coupon.trim()) return
    setApplyingCoupon(true)
    const res = await fetch('/api/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: coupon }) })
    const data = await res.json()
    if (res.ok) { toast.success(data.message ?? 'Coupon applied'); setCoupon('') }
    else toast.error(data.error ?? 'Invalid coupon')
    setApplyingCoupon(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
      <h1 className="display-sm text-[var(--ink-1)]">Account</h1>

      {/* Profile */}
      <GlassCard className="space-y-4 p-6">
        <p className="body font-semibold text-[var(--ink-1)]">Profile</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Full name</Label>
            <Input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Email</Label>
            <Input className={inputCls} value={user.email} readOnly disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Host name</Label>
            <Input className={inputCls} value={hostName} onChange={e => setHostName(e.target.value)} placeholder="How guests will know you" />
          </div>
        </div>
        <PillButton size="sm" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</PillButton>
      </GlassCard>

      {/* Plan + Billing link */}
      <GlassCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">Plan</p>
            <div className="mt-2 flex items-center gap-2">
              <PlanBadge plan={user.plan} />
              <span className="body-sm text-[var(--ink-3)] capitalize">{user.planStatus}</span>
            </div>
            {user.currentPeriodEnd && (
              <p className="body-sm mt-1 text-[var(--ink-3)]">
                {user.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {formatDate(user.currentPeriodEnd)}
              </p>
            )}
            {user.appliedCouponCode && (
              <p className="body-sm mt-1 text-[var(--accent-violet)]">Coupon applied: {user.appliedCouponCode}</p>
            )}
          </div>
          <Link
            href="/account/billing"
            className="body-sm flex shrink-0 items-center gap-1 rounded-full border px-4 py-2 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            Manage subscription <ArrowRight size={13} />
          </Link>
        </div>
      </GlassCard>

      {/* Feedback CTA */}
      <GlassCard className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <MessageSquare size={20} className="text-[var(--accent-violet)]" />
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">Tell us how it&apos;s going</p>
            <p className="body-sm text-[var(--ink-3)]">Share praise, gripes, or ideas. We read everything.</p>
          </div>
        </div>
        <Link href="/review" className="pill-primary pill-primary-sm">
          Leave feedback <ArrowRight size={13} />
        </Link>
      </GlassCard>

      {/* Coupon */}
      <GlassCard className="p-6">
        <p className="body mb-3 font-semibold text-[var(--ink-1)]">Coupon code</p>
        <div className="flex gap-2">
          <Input
            className={inputCls + ' flex-1'}
            value={coupon}
            onChange={e => setCoupon(e.target.value)}
            placeholder="Enter code"
            onKeyDown={e => e.key === 'Enter' && applyCoupon()}
          />
          <PillButton size="sm" onClick={applyCoupon} disabled={applyingCoupon}>
            {applyingCoupon ? '…' : 'Apply'}
          </PillButton>
        </div>
      </GlassCard>

      {/* Danger zone */}
      <GlassCard className="p-6" style={{ borderColor: 'rgba(255,69,58,0.2)' }}>
        <p className="body mb-3 font-semibold text-[var(--error)]">Danger zone</p>
        <PillButton
          variant="secondary"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="border-[rgba(255,69,58,0.3)] text-[var(--error)]"
        >
          Sign out
        </PillButton>
      </GlassCard>
    </div>
  )
}

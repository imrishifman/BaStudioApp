'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CheckCircle, Zap } from 'lucide-react'

function OnboardingContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const success = searchParams.get('success')
  const [influencer, setInfluencer] = useState<{ id: string; name: string; stripeAccountId: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`/api/influencers/connect?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setInfluencer(data); setLoading(false) })
  }, [token])

  async function handleConnect() {
    if (!influencer) return
    setConnecting(true)
    const res = await fetch('/api/influencers/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencerId: influencer.id }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    }
    setConnecting(false)
  }

  if (success) return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#4ade80' }} />
      <h1 className="display-sm text-[var(--ink-1)] mb-2">You're connected!</h1>
      <p className="body text-[var(--ink-2)]">Your Stripe account is set up. Commissions will be paid weekly.</p>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><p className="body text-[var(--ink-3)]">Loading…</p></div>
  if (!influencer) return <div className="text-center py-24"><p className="body text-[var(--ink-2)]">Invalid or expired link.</p></div>

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: 'var(--bg-3)' }}>
        <Zap size={22} style={{ color: 'var(--accent-violet)' }} />
      </div>
      <h1 className="display-sm text-[var(--ink-1)] mb-3">Set up payouts, {influencer.name}</h1>
      <p className="body text-[var(--ink-2)] mb-8">Connect your bank account via Stripe to receive your weekly commission payouts.</p>

      <GlassCard className="p-4 mb-6 text-left">
        {[
          'Secure bank connection powered by Stripe',
          'Weekly automatic transfers',
          'Full earnings dashboard',
        ].map((item, i) => (
          <div key={i} className="flex gap-2.5 py-1.5">
            <CheckCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
            <p className="body-sm text-[var(--ink-2)]">{item}</p>
          </div>
        ))}
      </GlassCard>

      <PillButton onClick={handleConnect} disabled={connecting}>
        {connecting ? 'Redirecting…' : 'Connect with Stripe'}
      </PillButton>
    </div>
  )
}

export default function InfluencerOnboardingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="body text-[var(--ink-3)]">Loading…</p></div>}>
      <OnboardingContent />
    </Suspense>
  )
}

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CheckCircle, FileText } from 'lucide-react'

function AgreementContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [influencer, setInfluencer] = useState<{ name: string; commissionValue: number | null; agreementSigned?: boolean } | null>(null)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`/api/influencers/connect?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { name: string; commissionValue: number | null; agreementSigned?: boolean } | null) => {
        setInfluencer(data)
        // Show the success state immediately if they've already signed.
        if (data?.agreementSigned) setSigned(true)
        setLoading(false)
      })
  }, [token])

  async function handleSign() {
    if (!token) return
    setSigning(true)
    setSignError(null)
    try {
      const res = await fetch('/api/influencers/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSignError(data.error ?? 'Could not record signature')
        return
      }
      setSigned(true)
    } catch {
      setSignError('Network error - please try again')
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="body text-[var(--ink-3)]">Loading…</p></div>
  if (!influencer) return (
    <div className="text-center py-24">
      <p className="body text-[var(--ink-2)]">Invalid or expired link.</p>
    </div>
  )

  if (signed) return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#4ade80' }} />
      <h1 className="display-sm text-[var(--ink-1)] mb-2">Agreement signed</h1>
      <p className="body text-[var(--ink-2)]">Thank you, {influencer.name}. You'll receive your onboarding link shortly.</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'var(--bg-3)' }}>
          <FileText size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <h1 className="display-sm text-[var(--ink-1)]">Influencer Agreement</h1>
        <p className="body text-[var(--ink-2)] mt-2">Hi {influencer.name}, please review and sign below.</p>
      </div>

      <GlassCard className="p-6 mb-6">
        <p className="body-sm font-semibold text-[var(--ink-1)] mb-3">Terms summary</p>
        <ul className="space-y-2">
          {[
            `You will earn ${influencer.commissionValue ?? 20}% commission on every converted sale attributed to your referral link.`,
            'Payouts are processed weekly via Stripe to your connected bank account.',
            "You may not misrepresent Ba-Studio's features or pricing in your promotions.",
            'Ba-Studio may terminate this agreement with 14 days’ notice.',
          ].map((term, i) => (
            <li key={i} className="flex gap-2.5 body-sm text-[var(--ink-2)]">
              <span className="shrink-0 text-[var(--ink-4)]">{i + 1}.</span>
              {term}
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="text-center">
        <PillButton onClick={handleSign} disabled={signing}>
          {signing ? 'Signing…' : 'Sign agreement'}
        </PillButton>
        {signError && (
          <p className="body-sm mt-3" style={{ color: 'var(--error)' }}>{signError}</p>
        )}
      </div>
    </div>
  )
}

export default function InfluencerAgreementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="body text-[var(--ink-3)]">Loading…</p></div>}>
      <AgreementContent />
    </Suspense>
  )
}

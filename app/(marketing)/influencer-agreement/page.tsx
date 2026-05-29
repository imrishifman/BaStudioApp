'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { CheckCircle, FileText, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface InfluencerSummary {
  name: string
  email?: string | null
  couponCode?: string | null
  commissionValue: number | null
  commissionType?: 'percentage' | 'fixed' | null
  agreementSigned?: boolean
}

function AgreementContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [influencer, setInfluencer] = useState<InfluencerSummary | null>(null)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`/api/influencers/connect?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: InfluencerSummary | null) => {
        setInfluencer(data)
        setFullName(data?.name ?? '')
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
        body: JSON.stringify({ token, fullName }),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="body text-[var(--ink-3)]">Loading…</p>
      </div>
    )
  }

  if (!influencer) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="body text-[var(--ink-2)]">Invalid or expired link.</p>
      </div>
    )
  }

  if (signed) {
    return <SuccessScreen influencer={influencer} />
  }

  const commission = influencer.commissionValue ?? 20
  const commissionType = influencer.commissionType ?? 'percentage'
  const commissionLabel = commissionType === 'fixed' ? `$${commission} per signup` : `${commission}%`

  const sections: { title: string; body: React.ReactNode }[] = [
    {
      title: '1. Partnership Overview',
      body: (
        <p>
          This Agreement is between <strong>{influencer.name}</strong> ("Partner") and
          BABALATA LLC d/b/a Ba Studio ("Company"). By signing, Partner agrees to act as
          an authorized affiliate promoter of Ba Studio products and services in
          exchange for the commission terms below.
        </p>
      ),
    },
    {
      title: '2. Commission Structure',
      body: (
        <>
          <p>
            Partner earns <strong>{commissionLabel}</strong> of net revenue (gross revenue
            minus payment processing fees, refunds, and chargebacks) for each customer
            who subscribes to a paid Ba Studio plan using Partner&apos;s unique coupon code
            <code className="mx-1 rounded bg-[var(--bg-3)] px-1.5 py-0.5 font-mono">
              {influencer.couponCode ?? 'YOURCODE'}
            </code>
            or referral link.
          </p>
          <p className="mt-2">
            Commissions accrue on every successful billing cycle within the attribution
            window. Subscription renewals continue to generate commission for as long
            as the customer remains active and Partner remains in good standing.
          </p>
        </>
      ),
    },
    {
      title: '3. Payment Terms',
      body: (
        <>
          <p>
            Payouts are processed <strong>every Monday</strong> via Stripe Express direct
            transfer to Partner&apos;s connected bank account. A <strong>$10 minimum</strong>
            balance is required to trigger a payout. Smaller balances roll forward
            to the next week.
          </p>
          <p className="mt-2">
            No commission is paid on refunded payments, chargebacks, fraudulent
            transactions, or subscriptions canceled within 14 days of initial purchase.
            Partner is responsible for any taxes owed on commissions earned.
          </p>
        </>
      ),
    },
    {
      title: '4. FTC Compliance',
      body: (
        <>
          <p>
            Partner must <strong>clearly disclose the affiliate relationship</strong> in every
            piece of promotional content, in compliance with the U.S. Federal Trade
            Commission&apos;s Endorsement Guides. Acceptable disclosures include{' '}
            <code className="rounded bg-[var(--bg-3)] px-1.5 py-0.5 font-mono">#ad</code>,{' '}
            <code className="rounded bg-[var(--bg-3)] px-1.5 py-0.5 font-mono">#sponsored</code>,
            or the phrase &quot;This is a paid partnership with Ba Studio.&quot;
          </p>
          <p className="mt-2">
            Disclosure must be visible without scrolling or clicking. Failure to
            comply may result in <strong>immediate termination</strong> of this Agreement
            and forfeiture of any accrued unpaid commissions.
          </p>
        </>
      ),
    },
    {
      title: '5. Content Guidelines',
      body: (
        <>
          <p>Partner agrees NOT to:</p>
          <ul className="mt-2 space-y-1 pl-5" style={{ listStyleType: 'disc' }}>
            <li>Make false or misleading claims about Ba Studio&apos;s features, pricing, or capabilities</li>
            <li>Use bots, paid clickfarms, or automated traffic of any kind</li>
            <li>Submit fraudulent conversions or self-referrals (purchases made by Partner or accounts they control)</li>
            <li>Impersonate Ba Studio staff, official accounts, or other partners</li>
            <li>Bid on Ba Studio trademark keywords in paid search</li>
            <li>Promote in spaces that violate Ba Studio brand standards</li>
          </ul>
        </>
      ),
    },
    {
      title: '6. AI Content Policy',
      body: (
        <p>
          AI-generated promotional content is permitted, provided Partner reviews
          the output for factual accuracy, ensures FTC disclosure is included, and
          does not represent AI outputs as Partner&apos;s personal experience when they
          aren&apos;t. AI-generated reviews of products Partner has not personally used
          are <strong>not</strong> permitted under any circumstances.
        </p>
      ),
    },
    {
      title: '7. Termination',
      body: (
        <p>
          Either party may terminate this Agreement with <strong>7 days&apos; written notice</strong>.
          Ba Studio reserves the right to terminate immediately, without notice, in
          cases of fraud, FTC violations, reputational harm, brand misrepresentation,
          or any material breach. Upon termination, Partner&apos;s coupon code is
          deactivated and any unpaid commissions earned in good faith prior to
          termination are paid out on the next regular payout cycle.
        </p>
      ),
    },
    {
      title: '8. Governing Law',
      body: (
        <p>
          This Agreement is governed by the laws of the State of Florida, USA.
          Any disputes shall first be addressed through good-faith negotiation
          between the parties. Unresolved disputes shall be settled by binding
          arbitration in Miami-Dade County, Florida.
        </p>
      ),
    },
  ]

  const canSign = fullName.trim().length >= 2 && agreed && !signing

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-3)' }}>
          <FileText size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <h1 className="display-sm text-[var(--ink-1)]">Influencer Partnership Agreement</h1>
        <p className="body mt-2 text-[var(--ink-2)]">
          Hi {influencer.name.split(' ')[0]}, please read the terms below and sign at the bottom.
        </p>
      </div>

      <GlassCard className="space-y-6 p-6 lg:p-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="body mb-2 font-semibold text-[var(--ink-1)]">{s.title}</h2>
            <div className="body-sm space-y-2 text-[var(--ink-2)]" style={{ lineHeight: 1.6 }}>
              {s.body}
            </div>
          </section>
        ))}
      </GlassCard>

      {/* Signature block */}
      <GlassCard className="mt-6 space-y-4 p-6 lg:p-8">
        <p className="body font-semibold text-[var(--ink-1)]">Signature</p>
        <div className="space-y-2">
          <label className="body-sm text-[var(--ink-3)]">Type your full legal name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border bg-[var(--bg-3)] p-3 body text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
            placeholder={influencer.name}
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span className="body-sm text-[var(--ink-2)]">
            I have read and fully agree to the BABALATA LLC / Ba Studio Influencer
            Partnership Agreement above. I understand my electronic signature here is
            legally binding and my IP address will be recorded as part of the signing
            record.
          </span>
        </label>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {signError && <p className="body-sm flex-1 text-[var(--error)]">{signError}</p>}
          <PillButton onClick={handleSign} disabled={!canSign}>
            {signing ? 'Signing…' : '✅ Sign agreement & activate coupon'}
          </PillButton>
        </div>
      </GlassCard>
    </div>
  )
}

function SuccessScreen({ influencer }: { influencer: InfluencerSummary }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bastudiopodcast.com'
  const referralUrl = influencer.couponCode ? `${baseUrl}/?ref=${influencer.couponCode}` : null

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <CheckCircle size={56} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
      <h1 className="display-sm text-[var(--ink-1)]">You&apos;re live! 🎉</h1>
      <p className="body mt-2 text-[var(--ink-2)]">
        Thanks, {influencer.name.split(' ')[0]}. Your coupon is active and tracking conversions.
      </p>

      <GlassCard className="mt-8 space-y-4 p-6 text-left">
        {influencer.couponCode && (
          <div className="rounded-[var(--radius-sm)] p-4" style={{ background: 'var(--bg-3)' }}>
            <p className="body-sm mb-1 text-[var(--ink-3)]">Your coupon code</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold tracking-wider text-[var(--ink-1)]" style={{ fontFamily: 'ui-monospace, SF Mono, monospace' }}>
                {influencer.couponCode}
              </p>
              <button
                onClick={() => copyToClipboard(influencer.couponCode!, 'Code')}
                className="flex items-center gap-1.5 body-sm rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        )}
        {referralUrl && (
          <div className="rounded-[var(--radius-sm)] p-4" style={{ background: 'var(--bg-3)' }}>
            <p className="body-sm mb-1 text-[var(--ink-3)]">Your referral link</p>
            <div className="flex items-center justify-between gap-3">
              <p className="body truncate font-mono text-[var(--ink-1)]">{referralUrl}</p>
              <button
                onClick={() => copyToClipboard(referralUrl, 'Link')}
                className="flex items-center gap-1.5 body-sm rounded-full border px-3 py-1.5 font-semibold text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[var(--radius-sm)] p-4 space-y-2" style={{ background: 'var(--bg-3)' }}>
          <p className="body-sm font-semibold text-[var(--ink-1)]">What&apos;s next</p>
          <ul className="body-sm space-y-1 text-[var(--ink-2)]" style={{ lineHeight: 1.5 }}>
            <li>📢 Share your code and link with your audience</li>
            <li>📊 Track your performance at <a href="/partner" className="underline">bastudiopodcast.com/partner</a></li>
            <li>💰 Payouts run every Monday once you connect Stripe (we&apos;ll email you the setup link)</li>
            <li>📝 Remember to disclose the partnership in your content (#ad / #sponsored)</li>
          </ul>
        </div>
      </GlassCard>

      <div className="mt-6">
        <a href="/partner" className="pill-primary pill-primary-sm">
          Go to my partner dashboard →
        </a>
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

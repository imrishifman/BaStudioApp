'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { PillButton } from '@/components/common/PillButton'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [planName, setPlanName] = useState('')

  useEffect(() => {
    if (!sessionId) { setStatus('error'); return }
    fetch('/api/stripe/verify-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setPlanName(data.planName ?? 'Studio Solo')
          setStatus('success')
          setTimeout(() => router.push('/studio'), 3000)
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [sessionId, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-6" style={{ background: 'var(--bg-0)' }}>
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--accent-violet)]" />
          <p className="body text-[var(--ink-2)]">Verifying your subscription…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-6">
          <CheckCircle2 size={56} style={{ color: 'var(--success)' }} />
          <div>
            <h1 className="display-md text-[var(--ink-1)]">Welcome to {planName}.</h1>
            <p className="body mt-2 text-[var(--ink-2)]">Redirecting you to the studio…</p>
          </div>
          <PillButton onClick={() => router.push('/studio')}>Go to Studio</PillButton>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-6">
          <XCircle size={56} style={{ color: 'var(--error)' }} />
          <div>
            <h1 className="display-sm text-[var(--ink-1)]">Something went wrong</h1>
            <p className="body mt-2 text-[var(--ink-2)]">
              Your payment may still have processed. Contact{' '}
              <a href="mailto:imri@babalata.com" className="underline">support</a>.
            </p>
          </div>
          <PillButton variant="secondary" onClick={() => router.push('/studio')}>Back to Studio</PillButton>
        </div>
      )}
    </div>
  )
}

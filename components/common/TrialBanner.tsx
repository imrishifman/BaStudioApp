'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { trackTrialExpired } from '@/lib/gtm'

// Reverse-trial chrome: a persistent thin top banner while the trial is active,
// and a one-time modal when it has ended. Both read flags computed in the auth
// session callback (session.user.isTrialActive / showTrialEndedNotice).

function daysLeft(trialEndsAt: string): number {
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export function TrialBanner() {
  const { data: session } = useSession()
  const router = useRouter()

  if (!session?.user?.isTrialActive || !session.user.trialEndsAt) return null
  const left = daysLeft(session.user.trialEndsAt)
  const urgent = left <= 2

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-2 text-[13px]"
      style={{
        background: urgent ? 'rgba(255,176,32,0.12)' : 'rgba(167,139,250,0.08)',
        borderBottom: `1px solid ${urgent ? 'rgba(255,176,32,0.30)' : 'rgba(167,139,250,0.15)'}`,
      }}
    >
      <p style={{ color: urgent ? 'var(--warning)' : 'var(--ink-2)' }}>
        <strong>Pro trial</strong> &middot; {left} day{left === 1 ? '' : 's'} left
      </p>
      <button
        onClick={() => router.push('/pricing')}
        className="shrink-0 rounded-full bg-[var(--ink-1)] px-3 py-1 text-[12px] font-semibold text-[var(--bg-0)] transition-all hover:scale-105"
      >
        Upgrade now
      </button>
    </div>
  )
}

// Shown once after the trial ends. Marks itself seen on the server so it never
// reappears, and fires the trial_expired event.
export function TrialEndedModal() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (session?.user?.showTrialEndedNotice && !firedRef.current) {
      firedRef.current = true
      setOpen(true)
      trackTrialExpired()
      // Persist that the notice has been shown so it appears exactly once.
      void fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialEndedNoticeShown: true }),
      })
    }
  }, [session])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
      >
        <h2 className="display-sm text-[var(--ink-1)]">Your Pro trial has ended</h2>
        <p className="body mt-2 text-[var(--ink-2)]">
          You can still view your episodes, but downloads and sharing are locked.
          Keep going, $19.99/mo.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => { setOpen(false); router.push('/pricing') }}
            className="pill-primary w-full justify-center"
          >
            Upgrade to Pro, $19.99/mo
          </button>
          <button
            onClick={() => setOpen(false)}
            className="body-sm py-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
          >
            Keep viewing for now
          </button>
        </div>
      </div>
    </div>
  )
}

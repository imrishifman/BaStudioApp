'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useState } from 'react'
import { canAccess } from '@/lib/plan-gating'

export function UpgradeBanner() {
  const { data: session } = useSession()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !session?.user) return null
  if (canAccess(session.user, 'master')) return null

  const isFree = session.user.plan === 'free'
  const message = isFree
    ? "You're on the Free plan. Upgrade to unlock unlimited episodes and team features."
    : 'Upgrade to Master for unlimited episodes, team seats, and more.'

  return (
    <div
      className="relative flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]"
      style={{
        background: 'rgba(167,139,250,0.08)',
        borderBottom: '1px solid rgba(167,139,250,0.15)',
      }}
    >
      <p className="text-[var(--ink-2)]">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => router.push('/pricing')}
          className="rounded-full bg-[var(--ink-1)] px-3 py-1 text-[12px] font-semibold text-[var(--bg-0)] transition-all hover:scale-105"
        >
          Upgrade
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

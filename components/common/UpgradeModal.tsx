'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PillButton } from '@/components/common/PillButton'
import { toast } from 'sonner'
import { trackPaywallUpgradeClicked, type PaywallGate } from '@/lib/gtm'

// Shared upgrade wall. Opened when a free user tries to extract value (download
// a script, share a guest brief, upload episode art). The CTA goes through the
// existing Stripe Checkout flow and deep-links back to `returnTo` after a
// successful payment so the user lands on the exact action they wanted.
export function UpgradeModal({
  open,
  onOpenChange,
  gate,
  returnTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gate: PaywallGate
  // Same-site relative path to return to after payment (e.g. /episodes/<id>).
  returnTo?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function upgrade() {
    trackPaywallUpgradeClicked(gate)
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'solo', period: 'monthly', returnTo }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      toast.error(data.error ?? 'Could not start checkout')
      setBusy(false)
    } catch {
      toast.error('Network error. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
        <DialogHeader>
          <div
            className="mb-2 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'color-mix(in srgb, var(--accent-violet) 18%, transparent)' }}
          >
            <Sparkles size={22} style={{ color: 'var(--accent-violet)' }} />
          </div>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            You&apos;ve built something great. Now take it with you.
          </DialogTitle>
          <DialogDescription className="body mt-1 text-[var(--ink-2)]">
            Free includes creating 1 episode. Upgrade to Pro to download scripts,
            share guest briefs, and create unlimited episodes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <PillButton onClick={upgrade} disabled={busy} className="w-full justify-center">
            {busy ? 'Opening checkout...' : 'Upgrade to Pro, $19.99/mo'}
          </PillButton>
          <button
            type="button"
            onClick={() => router.push('/pricing')}
            className="body-sm text-center text-[var(--ink-3)] hover:text-[var(--ink-1)]"
          >
            See all plans
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

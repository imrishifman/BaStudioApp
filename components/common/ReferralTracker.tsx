'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Fires once per page load when middleware has set the bas_ref cookie.
// Reads the current path so the click row records WHERE the visitor landed.
// Idempotency is enforced server-side (1 click per visitor+influencer per hour).
//
// We deliberately do NOT use useSearchParams here - it would force this
// component (and its parents) into a Suspense boundary across the whole app.
// Instead we read document.cookie: bas_ref is the source of truth after
// middleware ran, so the cookie check covers both first-touch and revisits.
export function ReferralTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!document.cookie.includes('bas_ref=')) return

    // Fire-and-forget. Failures are silent (server logs them).
    void fetch('/api/referrals/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landingPath: pathname }),
      keepalive: true,
    })
  }, [pathname])

  return null
}

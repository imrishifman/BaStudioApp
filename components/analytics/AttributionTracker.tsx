'use client'

import { useEffect } from 'react'
import { captureAttribution } from '@/lib/attribution'

// Captures gclid/gbraid/wbraid + UTM params into the 90-day attribution cookie on
// first paint. Paid traffic always arrives via a full page load, so a single
// capture on mount is sufficient; reading window.location.search directly (rather
// than useSearchParams) keeps this out of Suspense and lets it run as early as
// possible. Renders nothing.
export function AttributionTracker() {
  useEffect(() => {
    captureAttribution()
  }, [])

  return null
}

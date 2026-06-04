'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { spaPageView } from '@/lib/gtm'

// This is a single-page app: the document loads once and every subsequent
// navigation is client-side. On each route change we push an `spa_page_view`
// event so GTM can fire GA4 / Ads page-view tags off it. (Configure GA4's
// built-in page_view to NOT fire on container load, so this is the single
// source of truth and views aren't double-counted.)
//
// Must be rendered inside a <Suspense> boundary because useSearchParams()
// opts the subtree into client-side rendering.
export function GtmRouteTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const qs = searchParams?.toString()
    const fullPath = qs ? `${pathname}?${qs}` : pathname
    // Skip duplicate consecutive pushes (e.g. a re-render with the same path).
    if (fullPath === lastPath.current) return
    lastPath.current = fullPath
    spaPageView(fullPath, document.title)
  }, [pathname, searchParams])

  return null
}

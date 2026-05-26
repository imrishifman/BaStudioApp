'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Resets scroll to the top of the page on every route change. The browser
// doesn't do this for client-side App Router navigations.
export function ScrollToTopOnNav() {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

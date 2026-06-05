'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { appendAttributionToUrl } from '@/lib/attribution'
import { trackBeginSignup } from '@/lib/gtm'

// The single signup CTA for the paid landing page. It sends the visitor into the
// existing signup flow (/?signin=1) while preserving ALL current query params
// (gclid, gbraid, wbraid, utm_*, and anything else on the URL) plus whatever was
// captured into the attribution cookie. Attribution therefore survives the hop
// from ad click → landing page → signup. Fires begin_signup on click.
export function LpCta({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [href, setHref] = useState('/?signin=1')

  useEffect(() => {
    const dest = new URL('/?signin=1', window.location.origin)
    // Carry forward every param currently on the landing URL.
    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (!dest.searchParams.has(key)) dest.searchParams.set(key, value)
    })
    const relative = `${dest.pathname}${dest.search}`
    // Top up with anything stored in the attribution cookie too.
    setHref(appendAttributionToUrl(relative))
  }, [])

  return (
    <Link href={href} className={className} onClick={() => trackBeginSignup('lp_podcast_prep')}>
      {children}
    </Link>
  )
}

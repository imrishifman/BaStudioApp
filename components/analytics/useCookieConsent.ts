'use client'

import { useCallback, useEffect, useState } from 'react'
import { grantConsent, denyConsent } from '@/lib/gtm'

export type ConsentStatus = 'unknown' | 'granted' | 'denied'

const STORAGE_KEY = 'ba_cookie_consent'

// Simple consent hook the cookie banner (or any UI) can wire into.
//
// - `status` is the persisted choice ('unknown' until the visitor decides).
// - `accept()` grants Consent Mode v2 signals and remembers the choice.
// - `decline()` keeps everything denied and remembers the choice.
//
// On mount, a previously granted choice is re-applied so consent survives
// reloads (defaults start denied via the inline script in the document head).
export function useCookieConsent() {
  const [status, setStatus] = useState<ConsentStatus>('unknown')

  useEffect(() => {
    let saved: ConsentStatus = 'unknown'
    try {
      saved = (localStorage.getItem(STORAGE_KEY) as ConsentStatus) || 'unknown'
    } catch {
      saved = 'unknown'
    }
    setStatus(saved)
    // Re-apply a prior grant so returning visitors keep their consented state
    // (the document defaults to denied on every fresh load).
    if (saved === 'granted') grantConsent()
  }, [])

  const persist = useCallback((next: ConsentStatus) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable; choice simply won't persist */
    }
    setStatus(next)
  }, [])

  const accept = useCallback(() => {
    grantConsent()
    persist('granted')
  }, [persist])

  const decline = useCallback(() => {
    denyConsent()
    persist('denied')
  }, [persist])

  return { status, accept, decline }
}

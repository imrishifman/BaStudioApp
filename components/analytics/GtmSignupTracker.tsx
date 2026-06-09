'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { trackSignUp, trackTrialStarted } from '@/lib/gtm'

const COOKIE = 'ba_signup_method'

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`
}

// Fires the `sign_up` conversion exactly once for a brand-new account.
//
// New accounts always land on an authenticated page (/studio) after a full page
// load, so firing the event before that redirect would risk losing it. Instead a
// one-shot `ba_signup_method` cookie is set at the moment of account creation:
//   - email signups set it client-side in SignInDialog
//   - new Google users get it set server-side in the auth signIn callback
// This component reads the cookie once the session is known, fires sign_up with
// the real user_id, then deletes the cookie so it can never double-count.
export function GtmSignupTracker() {
  const { data: session, status } = useSession()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    if (status !== 'authenticated') return
    const method = readCookie(COOKIE)
    if (!method) return
    fired.current = true
    clearCookie(COOKIE)
    // Fire-and-forget: trackSignUp is async (it hashes the email for enhanced
    // conversions) but the dataLayer push happens synchronously once resolved.
    void trackSignUp({
      method,
      userId: session?.user?.id,
      email: session?.user?.email ?? undefined,
    })
    // Every new signup starts a 7-day reverse trial.
    trackTrialStarted()
  }, [status, session])

  return null
}

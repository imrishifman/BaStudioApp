'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Sparkles } from 'lucide-react'
import { pushEvent } from '@/lib/gtm'

// Shown exactly once, on first load after a comped account is auto-upgraded
// (see lib/comp-grants + the signIn callback). The message text comes from the
// session (session.user.compWelcomeMessage). Marks itself seen on the server so
// it never reappears.
export function CompWelcomeModal() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (session?.user?.showCompWelcome && !firedRef.current) {
      firedRef.current = true
      setOpen(true)
      pushEvent('comp_welcome_shown')
    }
  }, [session])

  function close() {
    void fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compWelcomeSeen: true }),
    })
    setOpen(false)
  }

  if (!open) return null
  const message =
    session?.user?.compWelcomeMessage ?? 'Welcome to Ba Studio. Your account has been upgraded.'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--accent-violet) 18%, transparent)' }}
        >
          <Sparkles size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <h2 className="display-sm text-[var(--ink-1)]">Welcome to Ba Studio</h2>
        <p className="body mt-2 text-[var(--ink-2)]">{message}</p>
        <div className="mt-5">
          <button onClick={close} className="pill-primary w-full justify-center">
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}

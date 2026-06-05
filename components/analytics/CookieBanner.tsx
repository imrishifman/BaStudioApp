'use client'

import { useCookieConsent } from './useCookieConsent'

// Minimal, privacy-first cookie banner. It stays hidden until the visitor makes
// a choice, defaults to nothing tracked (Consent Mode starts denied), and wires
// Accept / Decline straight into the consent hook. Restyle freely; the only
// contract that matters is calling accept() / decline().
export function CookieBanner() {
  const { status, accept, decline } = useCookieConsent()

  if (status !== 'unknown') return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 z-[100] w-full p-4 sm:bottom-6 sm:left-6 sm:w-auto sm:p-0"
    >
      <div
        className="flex w-full flex-col gap-4 rounded-2xl p-5 shadow-2xl sm:w-[360px]"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <p className="body-sm text-[var(--ink-2)]">
          We use cookies to measure traffic and improve Ba Studio. You can accept
          analytics and advertising cookies, or continue with only the essentials.
        </p>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            onClick={decline}
            className="body-sm rounded-full border px-4 py-2 font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="body-sm rounded-full bg-[var(--ink-1)] px-4 py-2 font-semibold text-[var(--bg-0)]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

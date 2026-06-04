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
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div
        className="mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl p-5 shadow-2xl sm:flex-row sm:items-center"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <p className="body-sm flex-1 text-[var(--ink-2)]">
          We use cookies to measure traffic and improve Ba Studio. You can accept
          analytics and advertising cookies, or continue with only the essentials.
        </p>
        <div className="flex shrink-0 items-center gap-2">
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

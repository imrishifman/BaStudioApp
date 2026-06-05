import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// Public, token-gated unsubscribe. The token in the email links here. If it
// matches a real user we flip marketingEmailOptIn off and show a confirmation.
// Idempotent: a second click on the same link just re-confirms the state.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  let status: 'ok' | 'invalid' = 'invalid'

  if (token && token.length > 10 && token.length < 200) {
    const user = await prisma.user.findUnique({ where: { unsubscribeToken: token } })
    if (user) {
      if (user.marketingEmailOptIn) {
        await prisma.user.update({
          where: { id: user.id },
          data: { marketingEmailOptIn: false },
        })
      }
      status = 'ok'
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-0)', color: 'var(--ink-1)' }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
      >
        {status === 'ok' ? (
          <>
            <h1 className="display-sm mb-3">You're unsubscribed</h1>
            <p className="body text-[var(--ink-2)]">
              We won't send you marketing emails any more. Transactional emails (billing,
              account, password reset) will still go through.
            </p>
            <p className="body-sm mt-6 text-[var(--ink-3)]">
              Changed your mind? Email us back from any prior message and we'll re-enable it.
            </p>
          </>
        ) : (
          <>
            <h1 className="display-sm mb-3">Link not recognised</h1>
            <p className="body text-[var(--ink-2)]">
              This unsubscribe link is missing or no longer valid. If you keep receiving
              emails, reply to one of them and we'll handle it directly.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

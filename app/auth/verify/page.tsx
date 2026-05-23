export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center"
      style={{ background: 'var(--bg-0)', padding: '0 clamp(20px, 5vw, 80px)' }}>
      <p className="display-sm text-[var(--ink-1)]">Check your email</p>
      <p className="body-lg text-[var(--ink-2)]" style={{ maxWidth: '42ch' }}>
        A magic sign-in link has been sent. Click it and you'll land right in
        your studio.
      </p>
    </div>
  )
}

export function MarketingFooter() {
  return (
    <footer style={{ background: 'var(--bg-0)', borderTop: '1px solid var(--line-1)' }}>
      {/* Giant wordmark */}
      <div
        className="overflow-hidden"
        style={{ padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px) 0' }}
      >
        <p
          className="select-none font-bold leading-none text-[var(--ink-4)]"
          style={{
            fontSize: 'clamp(64px, 12vw, 200px)',
            letterSpacing: '-0.04em',
          }}
        >
          Ba Studio
        </p>
      </div>

      {/* Copyright */}
      <div
        className="mx-auto flex max-w-[1240px] items-center justify-between py-6"
        style={{ padding: '24px clamp(20px, 5vw, 80px)' }}
      >
        <p className="body-sm text-[var(--ink-3)]">
          © {new Date().getFullYear()} Ba Studio. All rights reserved.
        </p>
        <p className="body-sm text-[var(--ink-3)]">English</p>
      </div>
    </footer>
  )
}

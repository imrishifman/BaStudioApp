import Link from 'next/link'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Roadmap', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Support', href: '#' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Cookies', href: '#' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer style={{ background: 'var(--bg-0)', borderTop: '1px solid var(--line-1)' }}>
      {/* Sitemap */}
      <div
        className="mx-auto grid max-w-[1240px] grid-cols-2 gap-10 py-16 md:grid-cols-4"
        style={{ padding: 'clamp(48px, 6vw, 80px) clamp(20px, 5vw, 80px)' }}
      >
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="eyebrow mb-4 text-[var(--ink-3)]">{col.title}</p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="body-sm text-[var(--ink-2)] no-underline transition-colors hover:text-[var(--ink-1)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hairline mx-auto max-w-[1240px]" />

      {/* Giant wordmark */}
      <div
        className="overflow-hidden"
        style={{ padding: 'clamp(24px, 4vw, 48px) clamp(20px, 5vw, 80px) 0' }}
      >
        <p
          className="select-none font-bold leading-none text-[var(--ink-4)]"
          style={{
            fontSize: 'clamp(64px, 12vw, 200px)',
            letterSpacing: '-0.04em',
          }}
        >
          Ba-Studio
        </p>
      </div>

      {/* Copyright */}
      <div
        className="mx-auto flex max-w-[1240px] items-center justify-between py-6"
        style={{ padding: '24px clamp(20px, 5vw, 80px)' }}
      >
        <p className="body-sm text-[var(--ink-3)]">
          © {new Date().getFullYear()} Ba-Studio. All rights reserved.
        </p>
        <p className="body-sm text-[var(--ink-3)]">English</p>
      </div>
    </footer>
  )
}

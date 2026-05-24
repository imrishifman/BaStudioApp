'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signIn } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Customers', href: '#customers' },
]

function scrollToHash(href: string) {
  if (!href.startsWith('#')) return
  const el = document.querySelector(href)
  if (!el) return
  const lenis = (
    window as unknown as {
      lenis?: { scrollTo: (t: Element, o?: { offset?: number }) => void }
    }
  ).lenis
  if (lenis) lenis.scrollTo(el, { offset: -64 })
  else el.scrollIntoView({ behavior: 'smooth' })
}

export function MarketingNav() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-14 transition-all duration-300',
        scrolled
          ? 'bg-[rgba(0,0,0,0.72)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--line-1)]'
          : 'bg-transparent'
      )}
    >
      <div
        className="mx-auto flex h-full max-w-[1240px] items-center justify-between"
        style={{ padding: '0 clamp(20px, 5vw, 80px)' }}
      >
        {/* Wordmark */}
        <Link href="/" className="no-underline">
          <Image
            src="/logo.png"
            alt="Ba Studio"
            width={160}
            height={69}
            priority
            className="brand-logo h-7 w-auto md:h-8"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => {
                e.preventDefault()
                scrollToHash(link.href)
              }}
              className="body-sm cursor-pointer text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            >
              {link.label}
            </a>
          ))}
          <div
            className="mx-2 h-4 w-px"
            style={{ background: 'var(--line-2)' }}
          />
          {session ? (
            <Link
              href="/studio"
              className="body-sm font-semibold text-[var(--ink-1)] transition-colors hover:text-[var(--accent-cyan)]"
            >
              Studio
            </Link>
          ) : (
            <button
              onClick={() => signIn()}
              className="body-sm text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            >
              Sign in
            </button>
          )}
          <Link href={session ? '/studio' : '/?signin=1'} className="pill-primary pill-primary-sm">
            Try Ba Studio
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[var(--ink-1)]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile sheet */}
      {menuOpen && (
        <div
          className="fixed inset-0 top-14 z-40 flex flex-col gap-1 p-6"
          style={{
            background: 'rgba(0,0,0,0.96)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="display-sm py-3 text-[var(--ink-1)] no-underline"
              onClick={(e) => {
                e.preventDefault()
                setMenuOpen(false)
                scrollToHash(link.href)
              }}
            >
              {link.label}
            </a>
          ))}
          <div className="hairline my-4" />
          {session ? (
            <Link
              href="/studio"
              className="display-sm py-3 text-[var(--ink-1)]"
              onClick={() => setMenuOpen(false)}
            >
              Go to Studio
            </Link>
          ) : (
            <button
              onClick={() => {
                setMenuOpen(false)
                signIn()
              }}
              className="display-sm py-3 text-left text-[var(--ink-1)]"
            >
              Sign in
            </button>
          )}
          <div className="mt-4">
            <Link
              href={session ? '/studio' : '/?signin=1'}
              className="pill-primary pill-primary-lg w-full"
              onClick={() => setMenuOpen(false)}
            >
              Try Ba Studio
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

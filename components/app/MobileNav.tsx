'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  BookOpen,
  Tv2,
  Calendar,
  Users,
  Settings,
  CreditCard,
  Menu,
  LogOut,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/common/ThemeToggle'

const PRIMARY = [
  { label: 'Studio', href: '/studio', icon: LayoutDashboard },
  { label: 'Episodes', href: '/dashboard', icon: BookOpen },
  { label: 'Shows', href: '/shows', icon: Tv2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
]

const MORE = [
  { label: 'Hub', href: '/team', icon: Users },
  { label: 'Account', href: '/account', icon: Settings },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Slim top bar */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center px-4 lg:hidden"
        style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)' }}
      >
        <Link href="/studio" className="no-underline">
          <Image
            src="/logo.png"
            alt="Ba Studio"
            width={140}
            height={60}
            priority
            className="brand-logo h-6 w-auto"
          />
        </Link>
      </header>

      {/* Bottom tab strip */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch lg:hidden"
        style={{
          background: 'var(--bg-1)',
          borderTop: '1px solid var(--line-1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {PRIMARY.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5"
              style={{ color: active ? 'var(--ink-1)' : 'var(--ink-3)' }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          data-tour="/team"
          data-tour-alt="theme"
          className="flex flex-1 flex-col items-center justify-center gap-0.5"
          style={{ color: 'var(--ink-3)' }}
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-t-2xl p-4"
            style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--line-1)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="body font-semibold text-[var(--ink-1)]">More</p>
              <button onClick={() => setMoreOpen(false)} className="text-[var(--ink-3)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {MORE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-[var(--ink-2)]"
              >
                <item.icon size={18} />
                <span className="body font-medium">{item.label}</span>
              </Link>
            ))}
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-[var(--ink-3)]"
            >
              <LogOut size={18} />
              <span className="body font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

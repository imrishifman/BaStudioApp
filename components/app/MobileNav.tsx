'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Handshake,
  Menu,
  LogOut,
  X,
} from 'lucide-react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { BaLogo } from '@/components/brand/BaLogo'
import { useT } from '@/components/i18n/I18nProvider'

const PRIMARY = [
  { labelKey: 'nav.studio', href: '/studio', icon: LayoutDashboard },
  { labelKey: 'nav.episodes', href: '/dashboard', icon: BookOpen },
  { labelKey: 'nav.shows', href: '/shows', icon: Tv2 },
  { labelKey: 'nav.calendar', href: '/calendar', icon: Calendar },
]

export function MobileNav({ isPartner = false }: { isPartner?: boolean }) {
  const pathname = usePathname()
  const t = useT()
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Build the "More" list with Partner inserted next to Account when applicable.
  const moreItems = [
    { labelKey: 'nav.hub', href: '/team', icon: Users },
    { labelKey: 'nav.account', href: '/account', icon: Settings },
    ...(isPartner ? [{ labelKey: 'nav.partner', href: '/partner', icon: Handshake }] : []),
    { labelKey: 'nav.pricing', href: '/pricing', icon: CreditCard },
  ]

  return (
    <>
      {/* Slim top bar */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center px-4 lg:hidden"
        style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)' }}
      >
        <Link href="/studio" className="no-underline" aria-label="Ba Studio studio home">
          <BaLogo size={24} className="text-[var(--ink-1)]" />
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
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
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
          <span className="text-[10px] font-medium">{t('common.more')}</span>
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
              <p className="body font-semibold text-[var(--ink-1)]">{t('common.more')}</p>
              <button onClick={() => setMoreOpen(false)} className="text-[var(--ink-3)]" aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-[var(--ink-2)]"
              >
                <item.icon size={18} />
                <span className="body font-medium">{t(item.labelKey)}</span>
              </Link>
            ))}
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-[var(--ink-3)]"
            >
              <LogOut size={18} />
              <span className="body font-medium">{t('common.signOut')}</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

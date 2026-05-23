'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Tv2, BookOpen, Calendar, Users, Mic2, Settings, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Studio', href: '/studio', icon: LayoutDashboard },
  { label: 'Episodes', href: '/dashboard', icon: BookOpen },
  { label: 'Shows', href: '/shows', icon: Tv2 },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Hub', href: '/team', icon: Users },
  { label: 'Guests', href: '/guests', icon: Users },
  { label: 'DNA', href: '/podcast-dna', icon: Mic2 },
  { label: 'Account', href: '/account', icon: Settings },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <>
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden"
        style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)' }}
      >
        <Link href="/studio" className="text-[var(--ink-1)] no-underline" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Ba-Studio
        </Link>
        <button onClick={() => setOpen(v => !v)} className="text-[var(--ink-1)]" aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Drawer */}
      {open && (
        <div
          className="fixed inset-0 top-14 z-50 flex flex-col gap-1 overflow-y-auto p-4 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(20px)' }}
        >
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3',
                pathname === item.href ? 'bg-[rgba(255,255,255,0.08)] text-[var(--ink-1)]' : 'text-[var(--ink-2)]'
              )}
            >
              <item.icon size={18} aria-hidden />
              <span className="body font-medium">{item.label}</span>
            </Link>
          ))}
          <div className="hairline my-2" />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-3 text-[var(--ink-3)]"
          >
            <span className="body">Sign out</span>
          </button>
        </div>
      )}
    </>
  )
}

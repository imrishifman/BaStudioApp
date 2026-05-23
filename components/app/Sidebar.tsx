'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Tv2,
  BookOpen,
  Calendar,
  Users,
  Mic2,
  Settings,
  CreditCard,
  ShieldCheck,
  UserCircle2,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { canAccess, isAdmin } from '@/lib/plan-gating'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  requiredPlan?: 'solo' | 'master'
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Studio', href: '/studio', icon: LayoutDashboard },
  { label: 'Episodes', href: '/dashboard', icon: BookOpen },
  { label: 'Shows', href: '/shows', icon: Tv2, requiredPlan: 'solo' },
  { label: 'Calendar', href: '/calendar', icon: Calendar, requiredPlan: 'solo' },
  { label: 'Hub', href: '/team', icon: Users, requiredPlan: 'master' },
  { label: 'Guests', href: '/guests', icon: UserCircle2, requiredPlan: 'solo' },
  { label: 'Podcast DNA', href: '/podcast-dna', icon: Mic2 },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Account', href: '/account', icon: Settings },
  { label: 'Pricing', href: '/pricing', icon: CreditCard },
]

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Admin', href: '/admin', icon: ShieldCheck, adminOnly: true },
  { label: 'Influencers', href: '/admin/influencers', icon: Users, adminOnly: true },
]

const PLAN_LABELS = { solo: 'Solo', master: 'Master' }

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className="hidden h-screen w-60 shrink-0 flex-col border-r lg:flex"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--line-1)',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center px-4"
        style={{ borderBottom: '1px solid var(--line-1)' }}
      >
        <Link
          href="/studio"
          className="text-[var(--ink-1)] no-underline"
          style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          Ba-Studio
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            active={isActive(item.href)}
            user={user}
          />
        ))}

        <div className="hairline my-3" />

        {BOTTOM_ITEMS.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            active={isActive(item.href)}
            user={user}
          />
        ))}

        {user && isAdmin(user) && (
          <>
            <div className="hairline my-3" />
            {ADMIN_ITEMS.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={isActive(item.href)}
                user={user}
              />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      {user && (
        <div style={{ borderTop: '1px solid var(--line-1)', padding: '12px' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 transition-colors hover:bg-[rgba(255,255,255,0.05)]">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                >
                  {initials(user.name)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <p className="body-sm truncate font-semibold text-[var(--ink-1)]">
                    {user.name ?? user.email}
                  </p>
                  {user.name && (
                    <p className="body-sm truncate text-[var(--ink-3)]">{user.email}</p>
                  )}
                </div>
                <ChevronDown size={14} className="shrink-0 text-[var(--ink-3)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className="w-52 border-[var(--line-1)] bg-[var(--bg-2)]"
            >
              <DropdownMenuItem asChild>
                <Link href="/account" className="body-sm text-[var(--ink-1)]">
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/pricing" className="body-sm text-[var(--ink-1)]">
                  Pricing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--line-1)]" />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/' })}
                className="body-sm text-[var(--ink-2)]"
              >
                <LogOut size={14} className="mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  )
}

function SidebarItem({
  item,
  active,
  user,
}: {
  item: NavItem
  active: boolean
  user: NonNullable<ReturnType<typeof useSession>['data']>['user'] | undefined
}) {
  const Icon = item.icon
  const locked =
    item.requiredPlan &&
    !canAccess(user as Parameters<typeof canAccess>[0], item.requiredPlan)

  return (
    <Link
      href={locked ? '/pricing' : item.href}
      className={cn(
        'relative flex h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 transition-colors',
        active
          ? 'bg-[rgba(255,255,255,0.06)] text-[var(--ink-1)]'
          : 'text-[var(--ink-2)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--ink-1)]'
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
          style={{ background: 'var(--accent-violet)' }}
        />
      )}
      <Icon size={18} className={cn('shrink-0', active ? 'text-[var(--ink-1)]' : 'text-[var(--ink-3)]')} aria-hidden />
      <span className="body flex-1 font-medium">{item.label}</span>
      {locked && item.requiredPlan && (
        <span
          className="body-sm rounded-full px-2 py-0.5 font-semibold"
          style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', border: '1px solid var(--line-1)' }}
        >
          {PLAN_LABELS[item.requiredPlan]}
        </span>
      )}
    </Link>
  )
}

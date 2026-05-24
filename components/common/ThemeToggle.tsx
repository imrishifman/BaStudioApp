'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export type Theme = 'dark' | 'light'

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('ba-theme', theme)
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    return (localStorage.getItem('ba-theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className={
        className ??
        'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[var(--ink-2)] transition-colors hover:bg-[rgba(127,127,127,0.08)] hover:text-[var(--ink-1)]'
      }
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      <span className="body-sm font-medium">
        {theme === 'dark' ? 'Dark' : 'Light'} mode
      </span>
    </button>
  )
}

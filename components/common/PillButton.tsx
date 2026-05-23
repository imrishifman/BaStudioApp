'use client'

import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'default' | 'lg'
}

export function PillButton({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: PillButtonProps) {
  const base =
    variant === 'primary'
      ? `pill-primary ${size === 'sm' ? 'pill-primary-sm' : size === 'lg' ? 'pill-primary-lg' : ''}`
      : `pill-secondary ${size === 'sm' ? '!h-[44px] !px-[22px] !text-sm' : size === 'lg' ? '!h-[60px] !px-9 !text-[17px]' : ''}`

  return (
    <button className={cn(base, className)} {...props}>
      {children}
    </button>
  )
}

import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function GlassCard({ className, hover, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass-card',
        hover &&
          'transition-transform duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:scale-[1.005]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

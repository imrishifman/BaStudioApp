import { cn } from '@/lib/utils'

interface EyebrowTagProps {
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function EyebrowTag({ children, dot, className }: EyebrowTagProps) {
  return (
    <div className={cn('eyebrow flex items-center gap-2 text-[var(--ink-3)]', className)}>
      {dot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--accent-violet)' }}
        />
      )}
      {children}
    </div>
  )
}

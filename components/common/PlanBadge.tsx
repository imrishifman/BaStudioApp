import { cn } from '@/lib/utils'
import type { Plan } from '@prisma/client'

const planLabels: Record<Plan, string> = {
  free: 'Free',
  solo: 'Solo',
  master: 'Master',
}

const planColors: Record<Plan, string> = {
  free: 'text-[var(--ink-3)] border-[var(--line-1)]',
  solo: 'text-[var(--accent-violet)] border-[rgba(167,139,250,0.3)]',
  master: 'text-[var(--accent-cyan)] border-[rgba(103,232,249,0.3)]',
}

interface PlanBadgeProps {
  plan: Plan
  className?: string
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        'body-sm inline-flex items-center rounded-full border px-2 py-0.5 font-semibold',
        planColors[plan],
        className
      )}
    >
      {planLabels[plan]}
    </span>
  )
}

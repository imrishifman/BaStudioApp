'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PillButton } from './PillButton'
import { useRouter } from 'next/navigation'
import type { Plan } from '@prisma/client'

interface FeatureLockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requiredPlan: Plan
  featureName?: string
}

const planLabels: Record<Plan, string> = {
  free: 'Free',
  solo: 'Studio Solo',
  master: 'Master',
}

export function FeatureLockModal({
  open,
  onOpenChange,
  requiredPlan,
  featureName,
}: FeatureLockModalProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--line-1)] bg-[var(--bg-2)] max-w-md">
        <DialogHeader>
          <DialogTitle className="display-sm text-[var(--ink-1)]">
            {planLabels[requiredPlan]} required
          </DialogTitle>
          <DialogDescription className="body text-[var(--ink-2)] mt-2">
            {featureName
              ? `${featureName} is available on the ${planLabels[requiredPlan]} plan and above.`
              : `This feature requires the ${planLabels[requiredPlan]} plan.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <PillButton
            onClick={() => {
              onOpenChange(false)
              router.push('/pricing')
            }}
          >
            Upgrade plan
          </PillButton>
          <PillButton variant="secondary" onClick={() => onOpenChange(false)}>
            Not now
          </PillButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  steps: { label: string }[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const stepNum = i + 1
        const done = stepNum < currentStep
        const active = stepNum === currentStep

        return (
          <div key={step.label} className="flex items-center">
            <button
              onClick={() => done && onStepClick?.(stepNum)}
              disabled={!done}
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                done ? 'cursor-pointer' : 'cursor-default',
                active ? 'scale-110' : ''
              )}
              style={{
                background: active
                  ? 'var(--ink-1)'
                  : done
                    ? 'var(--accent-violet)'
                    : 'var(--bg-3)',
                color: active ? 'var(--bg-0)' : done ? 'white' : 'var(--ink-3)',
                border: active ? '2px solid transparent' : '1px solid var(--line-2)',
              }}
              aria-label={`Step ${stepNum}: ${step.label}`}
            >
              {done ? '✓' : stepNum}
            </button>

            {i < steps.length - 1 && (
              <div
                className="h-px w-6 transition-all"
                style={{ background: done ? 'var(--accent-violet)' : 'var(--line-1)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

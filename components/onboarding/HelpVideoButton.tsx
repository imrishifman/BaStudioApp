'use client'

import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { OnboardingVideoModal } from './OnboardingVideoModal'

// Persistent help button. Rendered once in (app)/layout.tsx, so it follows the
// user across every authenticated page. Opens the same onboarding video the
// dashboard hero and wizard strip use.
export function HelpVideoButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Watch the onboarding demo"
        className="fixed right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] lg:right-6 lg:top-6"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
        }}
      >
        <CircleHelp size={16} />
      </button>
      <OnboardingVideoModal open={open} onOpenChange={setOpen} />
    </>
  )
}

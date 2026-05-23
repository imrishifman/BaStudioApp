'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { X, ChevronRight, Mic, Dna, Sparkles } from 'lucide-react'

interface Props {
  onDone: () => void
}

const STEPS = [
  { id: 'welcome', title: 'Welcome to Ba-Studio', icon: Mic },
  { id: 'dna', title: 'Set up your Podcast DNA', icon: Dna },
  { id: 'first-show', title: 'Name your first show', icon: Sparkles },
]

export function OnboardingWizard({ onDone }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [showName, setShowName] = useState('')
  const [showDescription, setShowDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFinish() {
    setSaving(true)
    try {
      if (showName.trim()) {
        await fetch('/api/shows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: showName.trim(), description: showDescription.trim() }),
        })
      }
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      })
      onDone()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    })
    onDone()
  }

  const StepIcon = STEPS[step].icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <GlassCard className="w-full max-w-lg p-8">
        {/* Progress dots */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{ background: i <= step ? 'var(--ink-1)' : 'var(--bg-3)' }}
            />
          ))}
        </div>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-3)' }}>
          <StepIcon size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>

        <h2 className="display-sm mb-2 text-[var(--ink-1)]">{STEPS[step].title}</h2>

        {step === 0 && (
          <div className="space-y-4">
            <p className="body text-[var(--ink-2)]">
              Ba-Studio turns your podcast prep into a structured, AI-assisted workflow — from guest research to final script.
            </p>
            <p className="body text-[var(--ink-2)]">
              We'll help you set up your Podcast DNA so every episode sounds unmistakably <em>you</em>.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="body text-[var(--ink-2)]">
              Your Podcast DNA defines your show's structure, tone, signature phrases, and editorial voice. The AI uses it to personalise every script.
            </p>
            <p className="body text-[var(--ink-2)]">
              You can fill it in now from <strong className="text-[var(--ink-1)]">Podcast DNA</strong> in the sidebar, or skip and do it later.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="body-sm text-[var(--ink-2)]">Show name</label>
              <Input
                value={showName}
                onChange={e => setShowName(e.target.value)}
                placeholder="e.g. The Founder Files"
                className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
              />
            </div>
            <div className="space-y-2">
              <label className="body-sm text-[var(--ink-2)]">One-line description <span className="text-[var(--ink-4)]">(optional)</span></label>
              <Textarea
                value={showDescription}
                onChange={e => setShowDescription(e.target.value)}
                placeholder="Weekly conversations with founders who are changing the world."
                className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)] resize-none"
                rows={2}
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="body-sm text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors"
          >
            Skip setup
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <PillButton variant="secondary" size="sm" onClick={() => setStep(s => s - 1)}>
                Back
              </PillButton>
            )}
            {step < STEPS.length - 1 ? (
              <PillButton size="sm" onClick={() => setStep(s => s + 1)}>
                Continue <ChevronRight size={14} />
              </PillButton>
            ) : (
              <PillButton size="sm" onClick={handleFinish} disabled={saving}>
                {saving ? 'Saving…' : 'Get started'}
              </PillButton>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

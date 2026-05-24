'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronRight, Mic, Dna, Sparkles, Palette } from 'lucide-react'
import {
  applyTheme,
  getStoredTheme,
  type Theme,
} from '@/components/common/ThemeToggle'

interface Props {
  onDone: () => void
}

const STEPS = [
  { id: 'welcome', title: 'Welcome to Ba Studio', icon: Mic },
  { id: 'mood', title: 'Pick your mood lighting', icon: Palette },
  { id: 'dna', title: 'Set up your Podcast DNA', icon: Dna },
  { id: 'first-show', title: 'Name your first show', icon: Sparkles },
] as const

export function OnboardingWizard({ onDone }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [showName, setShowName] = useState('')
  const [showDescription, setShowDescription] = useState('')
  const [theme, setTheme] = useState<Theme>('dark')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTheme(getStoredTheme())
  }, [])

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

  const current = STEPS[step].id
  const StepIcon = STEPS[step].icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
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

        <div
          className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--bg-3)' }}
        >
          <StepIcon size={22} style={{ color: 'var(--accent-violet)' }} />
        </div>

        <h2 className="display-sm mb-2 text-[var(--ink-1)]">{STEPS[step].title}</h2>

        {current === 'welcome' && (
          <div className="space-y-4">
            <p className="body text-[var(--ink-2)]">
              Ba Studio turns your podcast prep into a structured, AI-assisted
              workflow, from guest research to final script.
            </p>
            <p className="body text-[var(--ink-2)]">
              We&apos;ll help you set up your Podcast DNA so every episode sounds
              unmistakably <em>you</em>.
            </p>
          </div>
        )}

        {current === 'mood' && (
          <div className="space-y-4">
            <p className="body text-[var(--ink-2)]">
              Choose how Ba Studio looks. You can change it anytime from the sidebar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t)
                    applyTheme(t)
                  }}
                  className="rounded-[var(--radius-md)] border p-3 text-left transition-all"
                  style={{
                    borderColor: theme === t ? 'var(--accent-violet)' : 'var(--line-2)',
                    background: 'var(--bg-3)',
                  }}
                >
                  <div
                    className="mb-2 h-16 w-full rounded-md"
                    style={{
                      background: t === 'dark' ? '#000000' : '#ffffff',
                      border: '1px solid var(--line-2)',
                    }}
                  />
                  <p className="body-sm font-semibold capitalize text-[var(--ink-1)]">
                    {t} mode
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {current === 'dna' && (
          <div className="space-y-4">
            <p className="body text-[var(--ink-2)]">
              Your Podcast DNA defines your show&apos;s structure, tone, signature
              phrases, and editorial voice. The AI uses it to personalise every script.
            </p>
            <p className="body text-[var(--ink-2)]">
              You&apos;ll set it up inside each show after this. For now, let&apos;s
              name your first show.
            </p>
          </div>
        )}

        {current === 'first-show' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="body-sm text-[var(--ink-2)]">Show name</label>
              <Input
                value={showName}
                onChange={(e) => setShowName(e.target.value)}
                placeholder="e.g. The Founder Files"
                className="bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
              />
            </div>
            <div className="space-y-2">
              <label className="body-sm text-[var(--ink-2)]">
                One-line description <span className="text-[var(--ink-4)]">(optional)</span>
              </label>
              <Textarea
                value={showDescription}
                onChange={(e) => setShowDescription(e.target.value)}
                placeholder="Weekly conversations with founders changing the world."
                className="resize-none border-[var(--line-2)] bg-[var(--bg-3)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]"
                rows={2}
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="body-sm text-[var(--ink-4)] transition-colors hover:text-[var(--ink-2)]"
          >
            Maybe later
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <PillButton variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </PillButton>
            )}
            {step < STEPS.length - 1 ? (
              <PillButton size="sm" onClick={() => setStep((s) => s + 1)}>
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

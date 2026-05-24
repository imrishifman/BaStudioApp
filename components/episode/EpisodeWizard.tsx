'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { Episode, Show } from '@prisma/client'
import { StepIndicator } from './StepIndicator'
import { PillButton } from '@/components/common/PillButton'
import { Step1GuestName } from './Step1GuestName'
import { Step2GuestBio } from './Step2GuestBio'
import { Step3Focus } from './Step3Focus'
import { Step4Style } from './Step4Style'
import { Step5Questions } from './Step5Questions'
import { Step6Intro } from './Step6Intro'
import { Step7Script } from './Step7Script'
import { Step8Video } from './Step8Video'
import { Step9Share } from './Step9Share'
import { Step10Promote } from './Step10Promote'
import { AILoadingProvider } from './AILoadingContext'
import { EpisodeReadyOverlay } from './EpisodeReadyOverlay'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  episode: Episode | null
  shows: Show[]
  userEmail: string
}

function buildSteps(show: Show | null) {
  const base = [
    { label: 'Guest' },
    { label: 'Bio' },
    { label: 'Focus' },
    { label: 'Style' },
    { label: 'Questions' },
    { label: 'Intro' },
    { label: 'Script' },
    { label: 'Share' },
  ]
  const steps = [...base]
  if (show?.includeVideoStep) steps.splice(7, 0, { label: 'Video' })
  if (show?.includePromoteStep) steps.push({ label: 'Promote' })
  return steps
}

export function EpisodeWizard({ episode: initialEpisode, shows, userEmail }: Props) {
  const router = useRouter()
  const [episode, setEpisode] = useState<Episode | null>(initialEpisode)
  const [currentStep, setCurrentStep] = useState(initialEpisode?.currentStep ?? 1)
  const [exitOpen, setExitOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [dir, setDir] = useState(1)
  const [showReady, setShowReady] = useState(false)
  const readyShownRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedShow = shows.find(s => s.id === episode?.showId) ?? null
  const steps = buildSteps(selectedShow)

  // Keyboard: Esc → exit dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExitOpen(true) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-save every 30s
  useEffect(() => {
    if (!episode) return
    const id = setInterval(() => autoSave(episode), 30_000)
    return () => clearInterval(id)
  }, [episode])

  async function autoSave(ep: Episode) {
    if (!ep.id) return
    await fetch(`/api/episodes/${ep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStep }),
    })
    setLastSaved(new Date())
  }

  async function createOrUpdateEpisode(patch: Partial<Episode>): Promise<Episode> {
    if (episode?.id) {
      const res = await fetch(`/api/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, currentStep }),
      })
      const updated = await res.json()
      setEpisode(updated)
      setLastSaved(new Date())
      return updated
    } else {
      const res = await fetch('/api/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, currentStep: 1, createdByEmail: userEmail }),
      })
      const created = await res.json()
      setEpisode(created)
      setLastSaved(new Date())
      // Update URL without navigation
      window.history.replaceState({}, '', `/episodes/${created.id}`)
      return created
    }
  }

  async function goNext(patch?: Partial<Episode>) {
    const leavingLabel = steps[currentStep - 1]?.label
    setDir(1)
    if (patch) await createOrUpdateEpisode({ ...patch, currentStep: currentStep + 1 })
    else if (episode?.id) {
      await fetch(`/api/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStep: currentStep + 1 }),
      })
    }
    setCurrentStep(s => Math.min(s + 1, steps.length))
    // Celebrate once the full script is done.
    if (leavingLabel === 'Script' && !readyShownRef.current) {
      readyShownRef.current = true
      setShowReady(true)
    }
  }

  function goBack() {
    setDir(-1)
    setCurrentStep(s => Math.max(s - 1, 1))
  }

  const stepProps = { episode, show: selectedShow, shows, onNext: goNext, userEmail }

  function renderStep() {
    const label = steps[currentStep - 1]?.label
    switch (label) {
      case 'Guest': return <Step1GuestName {...stepProps} onEpisodeCreated={ep => setEpisode(ep)} />
      case 'Bio': return <Step2GuestBio {...stepProps} />
      case 'Focus': return <Step3Focus {...stepProps} />
      case 'Style': return <Step4Style {...stepProps} />
      case 'Questions': return <Step5Questions {...stepProps} />
      case 'Intro': return <Step6Intro {...stepProps} />
      case 'Script': return <Step7Script {...stepProps} />
      case 'Video': return <Step8Video {...stepProps} />
      case 'Share': return <Step9Share {...stepProps} />
      case 'Promote': return <Step10Promote {...stepProps} />
      default: return null
    }
  }

  return (
    <AILoadingProvider>
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg-0)' }}>
      {/* Wizard header */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3"
        style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)', backdropFilter: 'blur(12px)' }}
      >
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={s => { setDir(s > currentStep ? 1 : -1); setCurrentStep(s) }}
        />
        <button
          onClick={() => setExitOpen(true)}
          className="text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
          aria-label="Exit wizard"
        >
          <X size={18} />
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6 lg:p-8">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={currentStep}
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? 44 : -44, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d > 0 ? -44 : 44, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom action row */}
      <div
        className="sticky bottom-0 flex items-center justify-between gap-4 px-6 py-4"
        style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--line-1)' }}
      >
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <PillButton variant="secondary" size="sm" onClick={goBack}>
              <ArrowLeft size={14} /> Back
            </PillButton>
          )}
          {lastSaved && (
            <p className="body-sm text-[var(--ink-4)]">
              Saved {Math.round((Date.now() - lastSaved.getTime()) / 1000)}s ago
            </p>
          )}
        </div>
        {/* Step renders its own Next button — this is just the default */}
        {!['Questions', 'Intro', 'Script', 'Share', 'Promote'].includes(steps[currentStep - 1]?.label ?? '') && (
          <PillButton size="sm" onClick={() => goNext()}>
            Next <ArrowRight size={14} />
          </PillButton>
        )}
      </div>

      {/* Exit confirmation */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="border-[var(--line-1)]" style={{ background: 'var(--bg-2)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--ink-1)]">Leave the wizard?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-2)]">
              Your progress is saved. You can return to this episode any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--line-1)] bg-transparent text-[var(--ink-1)]">
              Keep working
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => router.push('/dashboard')}
              className="bg-[var(--ink-1)] text-[var(--bg-0)]"
            >
              Exit to episodes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showReady && <EpisodeReadyOverlay onContinue={() => setShowReady(false)} />}
    </div>
    </AILoadingProvider>
  )
}

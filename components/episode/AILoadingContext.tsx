'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AILoadingScreen, type AIStep } from './AILoadingScreen'

interface AILoadingCtx {
  /** Runs an AI call behind the full-screen loading overlay. */
  runAI: <T>(step: AIStep, fn: (signal: AbortSignal) => Promise<T>) => Promise<T>
}

const Ctx = createContext<AILoadingCtx | null>(null)

export function useAILoading() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAILoading must be used within an AILoadingProvider')
  return ctx
}

// Time the overlay stays up after a call resolves: bar snap (0.3s) + fade (0.5s).
const FADE_MS = 850

export function AILoadingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState<AIStep>('research')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const runAI = useCallback(
    async <T,>(s: AIStep, fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      const controller = new AbortController()
      abortRef.current = controller
      setStep(s)
      setProgress(0)
      setActive(true)
      try {
        const result = await fn(controller.signal)
        setProgress(100)
        await new Promise((r) => setTimeout(r, FADE_MS))
        return result
      } finally {
        setActive(false)
        setProgress(0)
        abortRef.current = null
      }
    },
    []
  )

  const onCancel = useCallback(() => {
    abortRef.current?.abort()
    setActive(false)
    setProgress(0)
  }, [])

  return (
    <Ctx.Provider value={{ runAI }}>
      {children}
      {active && <AILoadingScreen progress={progress} step={step} onCancel={onCancel} />}
    </Ctx.Provider>
  )
}

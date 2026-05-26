'use client'

import { useState } from 'react'
import type { Episode, Show } from '@prisma/client'
import { PillButton } from '@/components/common/PillButton'
import { GlassCard } from '@/components/common/GlassCard'
import { Sparkles, Check, Telescope, Link as LinkIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAILoading } from './AILoadingContext'
import { postAI } from '@/lib/ai-client'

interface Props {
  episode: Episode | null
  show: Show | null
  shows: Show[]
  onNext: (patch?: Partial<Episode>) => Promise<void>
  userEmail: string
}

// The 16 built-in interviewers (per spec) — name + emoji + one-line description.
const INFLUENCERS: { name: string; emoji: string; desc: string }[] = [
  { name: 'Lex Fridman', emoji: '🎙', desc: 'Long-form, philosophical, deeply curious' },
  { name: "Conan O'Brien", emoji: '😂', desc: 'Playful, warm, comedic and disarming' },
  { name: 'Tim Ferriss', emoji: '💡', desc: 'Tactical, deconstructing success, habit-focused' },
  { name: 'Andrew Huberman', emoji: '🧠', desc: 'Science-driven, educational, precise' },
  { name: 'Brené Brown', emoji: '❤️', desc: 'Vulnerable, emotional, story-led' },
  { name: 'How I Built This (Guy Raz)', emoji: '💼', desc: 'Founder journey, narrative arc, humble' },
  { name: 'Diary of a CEO (Steven Bartlett)', emoji: '🔥', desc: 'Raw, personal, challenging assumptions' },
  { name: 'Howard Stern', emoji: '🎤', desc: 'Provocative, deeply personal, nothing off-limits' },
  { name: 'Armchair Expert (Dax Shepard)', emoji: '📖', desc: 'Conversational, honest, meandering in a good way' },
  { name: 'Fresh Air (Terry Gross)', emoji: '🌍', desc: 'Literary, precise, culturally informed' },
  { name: 'My First Million', emoji: '💰', desc: 'Business ideas, energetic, riff-based' },
  { name: 'Rich Roll', emoji: '🧬', desc: 'Wellness, transformation, depth over entertainment' },
  { name: 'Masters of Scale (Reid Hoffman)', emoji: '🎯', desc: 'Strategic, counterintuitive, big-picture' },
  { name: 'SmartLess (Bateman/Arnett/Hayes)', emoji: '🌟', desc: 'Surprise-driven, fun, celebrity banter' },
  { name: 'Hot Ones', emoji: '🎬', desc: 'Unexpected questions, disarming format, genuine moments' },
  { name: 'This American Life', emoji: '📻', desc: 'Narrative storytelling, emotional truth, journalism' },
]
const BUILTIN_NAMES = new Set(INFLUENCERS.map((i) => i.name))

const MAX = 3

export function Step4Style({ episode, onNext }: Props) {
  const { runAI } = useAILoading()
  const [selected, setSelected] = useState<string[]>(episode?.interviewInfluences ?? [])
  const [profiles, setProfiles] = useState<Record<string, string>>(
    () => ((episode?.influenceProfiles as Record<string, string> | null) ?? {})
  )
  // Custom cards from previous URL research / custom additions.
  const [customDescs, setCustomDescs] = useState<Record<string, string>>({})
  const [researching, setResearching] = useState<Record<string, boolean>>({})
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  function toggle(name: string) {
    setSelected((prev) => {
      const isOn = prev.includes(name)
      if (isOn) return prev.filter((v) => v !== name)
      if (prev.length >= MAX) return prev
      // Newly selected — silently research the style in the background so the
      // profile is ready for question generation. UI doesn't show the profile.
      if (!profiles[name] && !researching[name]) researchStyleSilently(name)
      return [...prev, name]
    })
  }

  async function researchStyleSilently(name: string) {
    if (!episode?.id || profiles[name]) return
    setResearching((r) => ({ ...r, [name]: true }))
    try {
      const data = await postAI<{ profile?: string }>('/api/ai/influencer-profile', { episodeId: episode.id, name })
      if (data.profile) setProfiles((p) => ({ ...p, [name]: data.profile! }))
    } catch { /* silent — questions still work with name-only */ } finally {
      setResearching((r) => ({ ...r, [name]: false }))
    }
  }

  async function researchUrl() {
    if (!episode?.id || !url.trim()) return
    setUrlLoading(true)
    try {
      const data = await postAI<{ found: boolean; name?: string; vibe?: string; profile?: string }>(
        '/api/ai/influencer-from-url',
        { episodeId: episode.id, url: url.trim() }
      )
      if (!data.found || !data.name) {
        toast.error('Could not identify a show at that URL. Try adding by name.')
        return
      }
      setProfiles((p) => ({ ...p, [data.name!]: data.profile ?? '' }))
      setCustomDescs((d) => ({ ...d, [data.name!]: data.vibe ?? '' }))
      // Auto-select the new card (within cap).
      setSelected((prev) =>
        prev.includes(data.name!) || prev.length >= MAX ? prev : [...prev, data.name!]
      )
      setUrl('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not research that show')
    } finally {
      setUrlLoading(false)
    }
  }

  async function generateQuestions() {
    if (!episode?.id) return
    setGenerating(true)
    try {
      await runAI('questions', async (signal) =>
        postAI('/api/ai/questions', {
          episodeId: episode.id,
          showId: episode.showId,
          focusAnswers: episode.focusAnswers,
          influences: selected,
        }, signal)
      )
      await onNext({ interviewInfluences: selected, status: 'questions' })
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(err instanceof Error ? err.message : 'Could not generate questions')
      }
    } finally {
      setGenerating(false)
    }
  }

  // All cards to render = the 16 built-ins + any selected names that aren't built-in
  // (custom additions from URL research or prior episodes).
  const customNames = Array.from(
    new Set([...selected, ...Object.keys(customDescs)])
  ).filter((n) => !BUILTIN_NAMES.has(n))

  const cards: { name: string; emoji: string; desc: string }[] = [
    ...INFLUENCERS,
    ...customNames.map((n) => ({ name: n, emoji: '🔍', desc: customDescs[n] ?? 'Custom influence' })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1 text-[var(--ink-3)]">Step 4 of 10</p>
        <h2 className="display-sm text-[var(--ink-1)]">Interview style</h2>
        <p className="body mt-1 text-[var(--ink-2)]">
          Pick up to {MAX} interviewers whose style should shape your questions ({selected.length}/{MAX}). Click <em>Research this style</em> on the ones you choose so the AI can truly emulate them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map(({ name, emoji, desc }) => {
          const active = selected.includes(name)
          const isResearching = !!researching[name]
          return (
            <GlassCard
              key={name}
              onClick={() => toggle(name)}
              className="flex cursor-pointer items-start gap-2.5 p-3 transition-all"
              style={active ? { borderColor: 'var(--accent-violet)', background: 'rgba(167,139,250,0.06)' } : undefined}
            >
              <span className="text-xl leading-none">{emoji}</span>
              <span className="flex-1">
                <span className="body-sm block font-semibold text-[var(--ink-1)]">{name}</span>
                <span className="block text-[12px] text-[var(--ink-3)]">{desc}</span>
              </span>
              {active && isResearching && (
                <Loader2 size={12} className="mt-1 shrink-0 animate-spin text-[var(--ink-4)]" />
              )}
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: active ? 'var(--accent-violet)' : 'transparent', border: `1px solid ${active ? 'var(--accent-violet)' : 'var(--line-2)'}` }}
              >
                {active && <Check size={10} color="white" />}
              </span>
            </GlassCard>
          )
        })}
      </div>

      {/* Paste a podcast URL */}
      <div className="space-y-1.5">
        <p className="eyebrow text-[var(--ink-3)]">Or paste a podcast URL</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-4)]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); researchUrl() } }}
              placeholder="Apple Podcasts, Spotify, YouTube, or episode link"
              disabled={urlLoading}
              className="body-sm w-full rounded-[var(--radius-sm)] py-2 pl-7 pr-3"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', color: 'var(--ink-1)' }}
            />
          </div>
          <PillButton variant="secondary" size="sm" onClick={researchUrl} disabled={urlLoading || !url.trim()}>
            {urlLoading ? <><Loader2 size={13} className="animate-spin" /> Researching…</> : <><Telescope size={13} /> Research</>}
          </PillButton>
        </div>
      </div>

      <PillButton onClick={generateQuestions} disabled={generating || selected.length === 0} size="lg">
        <Sparkles size={16} /> Generate Questions
      </PillButton>
    </div>
  )
}

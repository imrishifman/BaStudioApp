'use client'

import { useEffect, useState } from 'react'
import { Wand2, Copy, Check, RefreshCw, Sparkles, ArrowRight } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { appendAttributionToUrl } from '@/lib/attribution'
import { trackBeginSignup } from '@/lib/gtm'

interface NameIdea { name: string; why?: string }

const EXAMPLES = [
  'A weekly show where two founders break down how real startups make money',
  'A cozy true-crime podcast hosted by best friends',
  'Interviews with marathon runners about training and mindset',
]

export function NameGeneratorClient() {
  const [description, setDescription] = useState('')
  const [names, setNames] = useState<NameIdea[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Signup href carries forward ad/UTM params + the attribution cookie, exactly
  // like the landing-page CTA, so credit survives the hop into signup.
  const [signupHref, setSignupHref] = useState('/?signin=1')

  useEffect(() => {
    const dest = new URL('/?signin=1', window.location.origin)
    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (!dest.searchParams.has(key)) dest.searchParams.set(key, value)
    })
    setSignupHref(appendAttributionToUrl(`${dest.pathname}${dest.search}`))
  }, [])

  async function generate() {
    if (description.trim().length < 3) {
      setError('Tell us a little about your podcast first (topic, vibe, audience).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/free/podcast-name-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setNames(null)
      } else {
        setNames(data.names)
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copy(name: string) {
    try {
      await navigator.clipboard.writeText(name)
      setCopied(name)
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500)
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="space-y-6">
      <GlassCard className="p-5 lg:p-6">
        <label htmlFor="png-input" className="body-sm font-medium text-[var(--ink-2)]">
          Describe your podcast
        </label>
        <textarea
          id="png-input"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 400))}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate() }}
          rows={3}
          placeholder="e.g. A weekly show where two founders break down how real startups make money"
          className="mt-2 w-full resize-none rounded-[var(--radius-md)] p-3 body text-[var(--ink-1)] outline-none"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PillButton onClick={generate} disabled={loading}>
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {loading ? 'Generating…' : names ? 'Generate more' : 'Generate names'}
          </PillButton>
          {!names && (
            <span className="body-sm text-[var(--ink-4)]">Free · no signup needed</span>
          )}
        </div>

        {!names && !loading && (
          <div className="mt-4">
            <p className="body-sm text-[var(--ink-4)] mb-2">Need a starting point? Try one:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDescription(ex)}
                  className="body-sm rounded-full px-3 py-1 text-left transition-colors"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
                >
                  {ex.length > 52 ? `${ex.slice(0, 52)}…` : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="body-sm mt-3 text-[var(--accent-rose,#fb7185)]">{error}</p>}
      </GlassCard>

      {names && names.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {names.map((n) => (
              <GlassCard key={n.name} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="body font-semibold text-[var(--ink-1)]">{n.name}</p>
                  {n.why && <p className="body-sm mt-0.5 text-[var(--ink-3)]">{n.why}</p>}
                </div>
                <button
                  onClick={() => copy(n.name)}
                  className="shrink-0 rounded-md p-1.5 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
                  title="Copy name"
                  aria-label={`Copy ${n.name}`}
                >
                  {copied === n.name ? <Check size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
                </button>
              </GlassCard>
            ))}
          </div>

          {/* Funnel: from a name they love into the full product. */}
          <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5" style={{ borderColor: 'var(--accent-violet)' }}>
            <div className="flex items-start gap-3">
              <Sparkles size={20} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-violet)' }} />
              <div>
                <p className="body font-semibold text-[var(--ink-1)]">Found a name you love?</p>
                <p className="body-sm text-[var(--ink-2)]">
                  Ba Studio takes it from there: plan episodes, write show notes, and produce your podcast with AI that learns how you sound.
                </p>
              </div>
            </div>
            <PillButton
              onClick={() => {
                trackBeginSignup('tool_podcast_name_generator')
                window.location.assign(signupHref)
              }}
            >
              Start free <ArrowRight size={15} />
            </PillButton>
          </GlassCard>
        </>
      )}
    </div>
  )
}

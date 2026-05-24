'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Show } from '@prisma/client'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type EpisodeSection = { id: string; name: string; minutes: number; purpose: string }

const TABS = ['Structure', 'Tone & Style', 'Signature', 'Audience', 'AI Instructions'] as const
type Tab = (typeof TABS)[number]

const TIMELINE_COLORS = [
  'var(--accent-violet)',
  'var(--accent-cyan)',
  'var(--accent-pink)',
  '#30d158',
  '#ffd60a',
  '#ff9f0a',
]

const DEFAULT_SECTIONS: EpisodeSection[] = [
  { id: 's1', name: 'Intro', minutes: 2, purpose: 'Welcome and set the scene' },
  { id: 's2', name: 'Part 1', minutes: 15, purpose: 'Origin story and background' },
  { id: 's3', name: 'Part 2', minutes: 20, purpose: 'Core insight and deep dive' },
  { id: 's4', name: 'Outro', minutes: 3, purpose: 'Wrap up and call to action' },
]

const TONE: { key: keyof Show; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'interviewStyle',
    label: 'Interview Style',
    options: [
      { value: 'conversational', label: 'Conversational' },
      { value: 'deep_dive', label: 'Deep Dive' },
      { value: 'fast_paced', label: 'Fast-Paced' },
      { value: 'philosophical', label: 'Philosophical' },
      { value: 'challenging', label: 'Challenging' },
      { value: 'supportive', label: 'Supportive' },
      { value: 'comedic', label: 'Comedic' },
    ],
  },
  {
    key: 'hostEnergy',
    label: 'Host Energy',
    options: [
      { value: 'warm_casual', label: 'Warm & Casual' },
      { value: 'professional_structured', label: 'Professional & Structured' },
      { value: 'curious_exploratory', label: 'Curious & Exploratory' },
      { value: 'edgy_provocative', label: 'Edgy & Provocative' },
      { value: 'inspirational', label: 'Inspirational' },
    ],
  },
  {
    key: 'languageLevel',
    label: 'Language Level',
    options: [
      { value: 'simple_accessible', label: 'Simple' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'advanced_technical', label: 'Advanced & Technical' },
    ],
  },
  {
    key: 'humorLevel',
    label: 'Humor Level',
    options: [
      { value: 'none', label: 'None' },
      { value: 'light', label: 'Light' },
      { value: 'medium', label: 'Medium' },
      { value: 'heavy', label: 'Heavy' },
    ],
  },
  {
    key: 'pacing',
    label: 'Pacing',
    options: [
      { value: 'slow_deep', label: 'Slow & Deep' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'fast_punchy', label: 'Fast & Punchy' },
    ],
  },
]

const GUEST_INTRO_OPTIONS = [
  { value: 'host_reads_bio', label: 'Host reads bio' },
  { value: 'guest_introduces_themselves', label: 'Guest introduces themselves' },
  { value: 'host_tells_a_story_about_guest', label: 'Host tells a story' },
  { value: 'no_intro_dive_straight_in', label: 'Dive straight in' },
]

const inputCls =
  'bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]'
const labelCls = 'body-sm text-[var(--ink-2)]'

function parseSections(raw: unknown): EpisodeSection[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((s, i) => {
      const o = s as Record<string, unknown>
      return {
        id: (o.id as string) ?? `s${i}-${Date.now()}`,
        name: (o.name ?? o.label ?? '') as string,
        minutes: Number(o.minutes ?? o.duration ?? 0) || 0,
        purpose: (o.purpose ?? '') as string,
      }
    })
  }
  return DEFAULT_SECTIONS
}

export function ShowDnaClient({ show }: { show: Show }) {
  const [tab, setTab] = useState<Tab>('Structure')
  const [fields, setFields] = useState<Partial<Show>>(show)
  const [sections, setSections] = useState<EpisodeSection[]>(
    parseSections(show.episodeSections)
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const firstRender = useRef(true)

  function setField<K extends keyof Show>(key: K, value: Show[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  // Debounced auto-save (1.5s) across all tabs.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setStatus('saving')
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shows/${show.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, episodeSections: sections }),
        })
        setStatus(res.ok ? 'saved' : 'idle')
      } catch {
        setStatus('idle')
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [fields, sections, show.id])

  // DNA completeness + gentle nudge toward the next high-impact field
  const checks: { label: string; done: boolean; tab: Tab }[] = [
    {
      label: 'episode structure',
      done: sections.length > 0 && sections.every((s) => s.name.trim() !== ''),
      tab: 'Structure',
    },
    { label: 'an opening line', done: !!(fields.openingLine ?? '').trim(), tab: 'Signature' },
    { label: 'a closing question', done: !!(fields.closingQuestion ?? '').trim(), tab: 'Signature' },
    { label: 'your show values', done: !!(fields.showValues ?? '').trim(), tab: 'Signature' },
    { label: 'your audience', done: !!(fields.targetAudience ?? '').trim(), tab: 'Audience' },
    { label: 'research instructions', done: !!(fields.aiResearchInstructions ?? '').trim(), tab: 'AI Instructions' },
    { label: 'question instructions', done: !!(fields.aiQuestionInstructions ?? '').trim(), tab: 'AI Instructions' },
    { label: 'script instructions', done: !!(fields.aiScriptInstructions ?? '').trim(), tab: 'AI Instructions' },
  ]
  const completeness = Math.round(
    (checks.filter((c) => c.done).length / checks.length) * 100
  )
  const nextMissing = checks.find((c) => !c.done)

  const celebrated = useRef(false)
  useEffect(() => {
    if (completeness === 100 && !celebrated.current) {
      celebrated.current = true
      import('canvas-confetti').then((m) =>
        m.default({ particleCount: 90, spread: 75, origin: { y: 0.3 } })
      )
    }
    if (completeness < 100) celebrated.current = false
  }, [completeness])

  const tabHasChecks = (t: Tab) => checks.some((c) => c.tab === t)
  const tabComplete = (t: Tab) =>
    checks.filter((c) => c.tab === t).every((c) => c.done)

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = [...sections]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    setSections(next)
  }

  const totalMinutes = sections.reduce((sum, s) => sum + (s.minutes || 0), 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/shows/${show.id}`}
            className="body-sm inline-flex items-center gap-1.5 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
          >
            <ArrowLeft size={14} /> {show.name}
          </Link>
          <h1 className="display-sm mt-1 text-[var(--ink-1)]">Podcast DNA</h1>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--ink-3)]">
          {status === 'saving' && (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span className="body-sm">Saving…</span>
            </>
          )}
          {status === 'saved' && (
            <>
              <Check size={14} style={{ color: 'var(--success)' }} />
              <span className="body-sm">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Completeness meter */}
      <GlassCard className="p-5">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <p className="body-sm font-semibold text-[var(--ink-1)]">
              {completeness === 100
                ? "Your show's DNA is fully tuned 🎙️"
                : `Your show's DNA is ${completeness}% complete`}
            </p>
            <p className="body-sm text-[var(--ink-3)]">
              {completeness === 100
                ? 'Every AI output will sound just like your show.'
                : nextMissing
                  ? `Add ${nextMissing.label} to make it stronger.`
                  : ''}
            </p>
          </div>
          <p
            className="font-bold text-[var(--ink-1)]"
            style={{ fontSize: 28, letterSpacing: '-0.02em' }}
          >
            {completeness}%
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${completeness}%`,
              background:
                completeness === 100
                  ? 'var(--success)'
                  : 'linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))',
            }}
          />
        </div>
      </GlassCard>

      {/* Tabs */}
      <div
        className="flex gap-1 overflow-x-auto rounded-full p-1"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)' }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'body-sm whitespace-nowrap rounded-full px-4 py-2 font-semibold transition-all',
              tab === t
                ? 'bg-[var(--ink-1)] text-[var(--bg-0)]'
                : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {t}
              {tabHasChecks(t) && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tabComplete(t) ? 'var(--success)' : 'var(--line-2)' }}
                />
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ---- Tab 1: Structure ---- */}
      {tab === 'Structure' && (
        <div className="space-y-6">
          {/* Timeline */}
          <GlassCard className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="body-sm font-semibold text-[var(--ink-1)]">Episode timeline</p>
              <p className="body-sm text-[var(--ink-3)]">{totalMinutes} min total</p>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
              {sections.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    width: `${totalMinutes ? (s.minutes / totalMinutes) * 100 : 0}%`,
                    background: TIMELINE_COLORS[i % TIMELINE_COLORS.length],
                  }}
                  title={`${s.name} · ${s.minutes}m`}
                />
              ))}
            </div>
          </GlassCard>

          {/* Sections (drag to reorder) */}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sections">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {sections.map((s, i) => (
                    <Draggable key={s.id} draggableId={s.id} index={i}>
                      {(p) => (
                        <div ref={p.innerRef} {...p.draggableProps}>
                          <GlassCard className="flex items-start gap-3 p-4">
                            <div
                              {...p.dragHandleProps}
                              className="mt-2 cursor-grab text-[var(--ink-4)]"
                            >
                              <GripVertical size={16} />
                            </div>
                            <span
                              className="mt-2 h-3 w-3 shrink-0 rounded-full"
                              style={{ background: TIMELINE_COLORS[i % TIMELINE_COLORS.length] }}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  className={cn(inputCls, 'flex-1')}
                                  value={s.name}
                                  placeholder="Section name"
                                  onChange={(e) =>
                                    setSections((prev) =>
                                      prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x))
                                    )
                                  }
                                />
                                <Input
                                  type="number"
                                  className={cn(inputCls, 'w-24')}
                                  value={s.minutes}
                                  placeholder="min"
                                  onChange={(e) =>
                                    setSections((prev) =>
                                      prev.map((x) =>
                                        x.id === s.id ? { ...x, minutes: Number(e.target.value) || 0 } : x
                                      )
                                    )
                                  }
                                />
                              </div>
                              <Input
                                className={inputCls}
                                value={s.purpose}
                                placeholder="Purpose of this section"
                                onChange={(e) =>
                                  setSections((prev) =>
                                    prev.map((x) => (x.id === s.id ? { ...x, purpose: e.target.value } : x))
                                  )
                                }
                              />
                            </div>
                            <button
                              onClick={() => setSections((prev) => prev.filter((x) => x.id !== s.id))}
                              className="mt-2 text-[var(--ink-4)] transition-colors hover:text-[var(--error)]"
                              aria-label="Delete section"
                            >
                              <Trash2 size={16} />
                            </button>
                          </GlassCard>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <button
            onClick={() =>
              setSections((prev) => [
                ...prev,
                { id: `s-${Date.now()}`, name: '', minutes: 5, purpose: '' },
              ])
            }
            className="body-sm flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed py-3 text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
            style={{ borderColor: 'var(--line-2)' }}
          >
            <Plus size={14} /> Add section
          </button>

          {/* Typical length + optional steps */}
          <GlassCard className="space-y-4 p-5">
            <div className="flex flex-col gap-1.5">
              <Label className={labelCls}>Typical episode length (minutes)</Label>
              <Input
                type="number"
                className={cn(inputCls, 'w-40')}
                value={fields.typicalEpisodeLengthMinutes ?? 45}
                onChange={(e) => setField('typicalEpisodeLengthMinutes', Number(e.target.value) || 0)}
              />
            </div>
            <ToggleRow
              label="Video / Media step"
              desc="Adds a video intro upload step to the episode wizard"
              checked={fields.includeVideoStep ?? false}
              onChange={(v) => setField('includeVideoStep', v)}
            />
            <ToggleRow
              label="Promote / Social step"
              desc="Adds social content generation to the episode wizard"
              checked={fields.includePromoteStep ?? false}
              onChange={(v) => setField('includePromoteStep', v)}
            />
          </GlassCard>
        </div>
      )}

      {/* ---- Tab 2: Tone & Style ---- */}
      {tab === 'Tone & Style' && (
        <div className="space-y-6">
          {TONE.map((cat) => (
            <GlassCard key={cat.key as string} className="p-5">
              <p className="body-sm mb-3 font-semibold text-[var(--ink-1)]">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {cat.options.map((opt) => {
                  const active = (fields[cat.key] as string) === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setField(cat.key, opt.value as never)}
                      className={cn(
                        'body-sm rounded-full border px-4 py-2 font-medium transition-all',
                        active
                          ? 'border-transparent bg-[var(--accent-violet)] text-[var(--bg-0)]'
                          : 'border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink-1)]'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ---- Tab 3: Signature ---- */}
      {tab === 'Signature' && (
        <GlassCard className="space-y-4 p-6">
          <TextField label="Opening line" placeholder="The exact phrase you open every episode with"
            value={fields.openingLine ?? ''} onChange={(v) => setField('openingLine', v)} />
          <TextField label="Closing question" placeholder="The last question you ask every guest"
            value={fields.closingQuestion ?? ''} onChange={(v) => setField('closingQuestion', v)} />
          <div className="flex flex-col gap-1.5">
            <Label className={labelCls}>Guest intro style</Label>
            <div className="flex flex-wrap gap-2">
              {GUEST_INTRO_OPTIONS.map((opt) => {
                const active = (fields.guestIntroStyle as string) === opt.value
                return (
                  <button key={opt.value}
                    onClick={() => setField('guestIntroStyle', opt.value as never)}
                    className={cn('body-sm rounded-full border px-4 py-2 font-medium transition-all',
                      active ? 'border-transparent bg-[var(--accent-violet)] text-[var(--bg-0)]'
                        : 'border-[var(--line-2)] text-[var(--ink-2)] hover:text-[var(--ink-1)]')}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <TextField label="Recurring segments" multiline placeholder="Fixed formats like rapid-fire rounds or 'Hot Take'"
            value={fields.recurringSegments ?? ''} onChange={(v) => setField('recurringSegments', v)} />
          <TextField label="Topics to avoid" multiline placeholder="Things that should never come up (politics, religion…)"
            value={fields.topicsToAvoid ?? ''} onChange={(v) => setField('topicsToAvoid', v)} />
          <TextField label="Show values" multiline placeholder="The editorial principles of your show"
            value={fields.showValues ?? ''} onChange={(v) => setField('showValues', v)} />
        </GlassCard>
      )}

      {/* ---- Tab 4: Audience ---- */}
      {tab === 'Audience' && (
        <GlassCard className="space-y-3 p-6">
          <div>
            <p className="body font-semibold text-[var(--ink-1)]">Who is this show for?</p>
            <p className="body-sm text-[var(--ink-3)]">
              The AI uses this to write questions and scripts that speak directly to your listeners.
            </p>
          </div>
          <Textarea
            className={inputCls}
            rows={6}
            placeholder="e.g. Early-stage founders who care about craft over hype, mostly 25–40, technical but time-poor…"
            value={fields.targetAudience ?? ''}
            onChange={(e) => setField('targetAudience', e.target.value)}
          />
        </GlassCard>
      )}

      {/* ---- Tab 5: AI Instructions ---- */}
      {tab === 'AI Instructions' && (
        <GlassCard className="space-y-4 p-6">
          <p className="body-sm text-[var(--ink-3)]">
            Brief the AI like a smart producer. Auto-saves as you type.
          </p>
          <TextField label="Research instructions" multiline
            placeholder="e.g. Find the failure story, not the Wikipedia page."
            value={fields.aiResearchInstructions ?? ''} onChange={(v) => setField('aiResearchInstructions', v)} />
          <TextField label="Question instructions" multiline
            placeholder="e.g. Never ask yes/no — always find the unexplored angle."
            value={fields.aiQuestionInstructions ?? ''} onChange={(v) => setField('aiQuestionInstructions', v)} />
          <TextField label="Script instructions" multiline
            placeholder="Voice, tone, and structure preferences for the intro and full script."
            value={fields.aiScriptInstructions ?? ''} onChange={(v) => setField('aiScriptInstructions', v)} />
          <TextField label="Social content instructions" multiline
            placeholder="How LinkedIn, Twitter, and Instagram posts should sound."
            value={fields.aiSocialInstructions ?? ''} onChange={(v) => setField('aiSocialInstructions', v)} />
        </GlassCard>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="body text-[var(--ink-1)]">{label}</p>
        <p className="body-sm text-[var(--ink-3)]">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={labelCls}>{label}</Label>
      {multiline ? (
        <Textarea className={inputCls} rows={3} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input className={inputCls} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

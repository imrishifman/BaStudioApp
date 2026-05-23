'use client'

import { useState, useCallback } from 'react'
import type { Show } from '@prisma/client'
import { GlassCard } from '@/components/common/GlassCard'
import { PillButton } from '@/components/common/PillButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  shows: Show[]
  initialShow: Show | null
}

type Section = 'identity' | 'structure' | 'tone' | 'signature' | 'influences' | 'ai' | 'options'

const SECTIONS: { key: Section; label: string; desc: string }[] = [
  { key: 'identity', label: 'Show identity', desc: 'Name, description, category, host, audience' },
  { key: 'structure', label: 'Structure', desc: 'Episode sections and timing' },
  { key: 'tone', label: 'Tone & energy', desc: 'Interview style, pacing, humor' },
  { key: 'signature', label: 'Signature', desc: 'Opening line, closing question, recurring segments' },
  { key: 'influences', label: 'Influences', desc: 'Podcasters that inspire your style' },
  { key: 'ai', label: 'AI instructions', desc: 'Guide the AI for each step' },
  { key: 'options', label: 'Optional steps', desc: 'Video and promote steps' },
]

export function PodcastDNAClient({ shows, initialShow }: Props) {
  const [show, setShow] = useState<Show | null>(initialShow)
  const [openSection, setOpenSection] = useState<Section | null>('identity')
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState<Partial<Show>>(initialShow ?? {})

  function setField<K extends keyof Show>(key: K, value: Show[K]) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const dnaFields: (keyof Show)[] = [
    'name', 'description', 'hostName', 'targetAudience', 'episodeSections',
    'interviewStyle', 'hostEnergy', 'languageLevel', 'humorLevel', 'pacing',
    'openingLine', 'closingQuestion', 'topicsToAvoid', 'guestIntroStyle',
    'recurringSegments', 'showValues', 'interviewInfluences',
    'aiResearchInstructions', 'aiQuestionInstructions', 'aiScriptInstructions', 'aiSocialInstructions',
    'includeVideoStep', 'includePromoteStep',
  ]

  function calcCompletion() {
    if (!fields) return 0
    const filled = dnaFields.filter(k => {
      const v = fields[k]
      if (Array.isArray(v)) return v.length > 0
      return v !== null && v !== undefined && v !== ''
    }).length
    return Math.round((filled / dnaFields.length) * 100)
  }

  async function saveSection() {
    if (!show) return
    setSaving(true)
    try {
      const res = await fetch(`/api/shows/${show.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) toast.success('Saved')
      else toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const completion = calcCompletion()

  if (!show) {
    return (
      <div className="mx-auto max-w-2xl p-6 lg:p-8 text-center">
        <GlassCard className="flex flex-col items-center gap-4 p-12">
          <p className="display-sm text-[var(--ink-1)]">No show yet</p>
          <p className="body text-[var(--ink-2)]">Create a show first to set up its DNA.</p>
          <PillButton onClick={() => window.location.href = '/shows'}><Plus size={14} /> Create show</PillButton>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="display-sm text-[var(--ink-1)]">Podcast DNA</h1>
          <p className="body text-[var(--ink-2)]">{show.name}</p>
        </div>
        <div className="text-right">
          <p className="display-sm font-bold text-[var(--ink-1)]" style={{ fontSize: 28 }}>{completion}%</p>
          <p className="body-sm text-[var(--ink-3)]">complete</p>
        </div>
      </div>

      {/* Completion bar */}
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${completion}%`, background: completion === 100 ? 'var(--success)' : 'var(--accent-violet)' }}
        />
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {SECTIONS.map(s => (
          <GlassCard key={s.key} className="overflow-hidden">
            <Collapsible
              open={openSection === s.key}
              onOpenChange={open => setOpenSection(open ? s.key : null)}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between p-5 text-left">
                <div>
                  <p className="body font-semibold text-[var(--ink-1)]">{s.label}</p>
                  <p className="body-sm text-[var(--ink-3)]">{s.desc}</p>
                </div>
                {openSection === s.key
                  ? <ChevronDown size={16} className="text-[var(--ink-3)] shrink-0" />
                  : <ChevronRight size={16} className="text-[var(--ink-3)] shrink-0" />}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t px-5 pb-6 pt-4 space-y-4" style={{ borderColor: 'var(--line-1)' }}>
                  <SectionFields sectionKey={s.key} fields={fields} setField={setField} />
                  <div className="pt-2">
                    <PillButton size="sm" onClick={saveSection} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </PillButton>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

function SectionFields({
  sectionKey,
  fields,
  setField,
}: {
  sectionKey: Section
  fields: Partial<Show>
  setField: <K extends keyof Show>(k: K, v: Show[K]) => void
}) {
  const inputCls = 'bg-[var(--bg-3)] border-[var(--line-2)] text-[var(--ink-1)] placeholder:text-[var(--ink-4)]'
  const labelCls = 'body-sm text-[var(--ink-2)]'

  if (sectionKey === 'identity') return (
    <div className="space-y-3">
      <Field label="Show name" value={fields.name ?? ''} onChange={v => setField('name', v)} cls={inputCls} labelCls={labelCls} />
      <Field label="Description" value={fields.description ?? ''} onChange={v => setField('description', v)} multiline cls={inputCls} labelCls={labelCls} />
      <Field label="Host name" value={fields.hostName ?? ''} onChange={v => setField('hostName', v)} cls={inputCls} labelCls={labelCls} />
      <Field label="Target audience" value={fields.targetAudience ?? ''} onChange={v => setField('targetAudience', v)} cls={inputCls} labelCls={labelCls} />
    </div>
  )

  if (sectionKey === 'tone') return (
    <div className="space-y-3">
      <SelectField label="Interview style" value={fields.interviewStyle ?? 'conversational'}
        options={['conversational','deep_dive','fast_paced','philosophical','challenging','supportive','comedic']}
        onChange={v => setField('interviewStyle', v as Show['interviewStyle'])} labelCls={labelCls} inputCls={inputCls} />
      <SelectField label="Host energy" value={fields.hostEnergy ?? 'warm_casual'}
        options={['warm_casual','professional_structured','curious_exploratory','edgy_provocative','inspirational']}
        onChange={v => setField('hostEnergy', v as Show['hostEnergy'])} labelCls={labelCls} inputCls={inputCls} />
      <SelectField label="Language level" value={fields.languageLevel ?? 'moderate'}
        options={['simple_accessible','moderate','advanced_technical']}
        onChange={v => setField('languageLevel', v as Show['languageLevel'])} labelCls={labelCls} inputCls={inputCls} />
      <SelectField label="Humor level" value={fields.humorLevel ?? 'light'}
        options={['none','light','medium','heavy']}
        onChange={v => setField('humorLevel', v as Show['humorLevel'])} labelCls={labelCls} inputCls={inputCls} />
      <SelectField label="Pacing" value={fields.pacing ?? 'balanced'}
        options={['slow_deep','balanced','fast_punchy']}
        onChange={v => setField('pacing', v as Show['pacing'])} labelCls={labelCls} inputCls={inputCls} />
    </div>
  )

  if (sectionKey === 'signature') return (
    <div className="space-y-3">
      <Field label="Opening line" value={fields.openingLine ?? ''} onChange={v => setField('openingLine', v)} cls={inputCls} labelCls={labelCls} />
      <Field label="Closing question" value={fields.closingQuestion ?? ''} onChange={v => setField('closingQuestion', v)} cls={inputCls} labelCls={labelCls} />
      <Field label="Recurring segments" value={fields.recurringSegments ?? ''} onChange={v => setField('recurringSegments', v)} multiline cls={inputCls} labelCls={labelCls} />
      <Field label="Topics to avoid" value={fields.topicsToAvoid ?? ''} onChange={v => setField('topicsToAvoid', v)} multiline cls={inputCls} labelCls={labelCls} />
    </div>
  )

  if (sectionKey === 'influences') return (
    <div className="space-y-3">
      <div>
        <Label className={labelCls}>Podcast influences (comma-separated names)</Label>
        <Input
          className={cn(inputCls, 'mt-1.5')}
          value={(fields.interviewInfluences ?? []).join(', ')}
          onChange={e => setField('interviewInfluences', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="e.g. Lex Fridman, Tim Ferriss, Brené Brown"
        />
      </div>
      <Field label="Style description" value={fields.interviewStyleDescription ?? ''} onChange={v => setField('interviewStyleDescription', v)} multiline cls={inputCls} labelCls={labelCls} />
    </div>
  )

  if (sectionKey === 'ai') return (
    <div className="space-y-3">
      <Field label="Research instructions" value={fields.aiResearchInstructions ?? ''} onChange={v => setField('aiResearchInstructions', v)} multiline cls={inputCls} labelCls={labelCls} placeholder="Tell the AI how to research guests..." />
      <Field label="Question instructions" value={fields.aiQuestionInstructions ?? ''} onChange={v => setField('aiQuestionInstructions', v)} multiline cls={inputCls} labelCls={labelCls} placeholder="How should questions be framed?" />
      <Field label="Script instructions" value={fields.aiScriptInstructions ?? ''} onChange={v => setField('aiScriptInstructions', v)} multiline cls={inputCls} labelCls={labelCls} placeholder="Tone, structure, and style for scripts..." />
      <Field label="Social instructions" value={fields.aiSocialInstructions ?? ''} onChange={v => setField('aiSocialInstructions', v)} multiline cls={inputCls} labelCls={labelCls} placeholder="How should social posts sound?" />
    </div>
  )

  if (sectionKey === 'options') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="body text-[var(--ink-1)]">Include video step</p>
          <p className="body-sm text-[var(--ink-3)]">Adds a video intro upload step to the wizard</p>
        </div>
        <Switch
          checked={fields.includeVideoStep ?? false}
          onCheckedChange={v => setField('includeVideoStep', v)}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="body text-[var(--ink-1)]">Include promote step</p>
          <p className="body-sm text-[var(--ink-3)]">Adds social content generation to the wizard</p>
        </div>
        <Switch
          checked={fields.includePromoteStep ?? false}
          onCheckedChange={v => setField('includePromoteStep', v)}
        />
      </div>
    </div>
  )

  return null
}

function Field({
  label, value, onChange, multiline, cls, labelCls, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  multiline?: boolean; cls: string; labelCls: string; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={labelCls}>{label}</Label>
      {multiline
        ? <Textarea className={cls} value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} />
        : <Input className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  )
}

function SelectField({
  label, value, options, onChange, labelCls, inputCls,
}: {
  label: string; value: string; options: string[]
  onChange: (v: string) => void; labelCls: string; inputCls: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={labelCls}>{label}</Label>
      <select
        className={cn(inputCls, 'h-10 rounded-[var(--radius-sm)] border px-3 text-sm')}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o} value={o} style={{ background: 'var(--bg-3)' }}>
            {o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </div>
  )
}

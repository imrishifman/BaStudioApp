// Shared model for the sectioned question-selection step. Used by the AI
// questions route, the script prompt, the brief page, and the wizard UI so they
// all agree on shape, section resolution, and ordering.

export interface QSection {
  name: string
  key: string
}

export interface GenQuestion {
  question: string
  strength_score?: number
  context?: string
  go_deeper?: string[]
}

export type GeneratedMap = Record<string, GenQuestion[]>

export const DEFAULT_SECTIONS: QSection[] = [
  { name: 'Warm-Up', key: 'warm_up' },
  { name: 'Core Questions', key: 'core_questions' },
  { name: 'Going Deeper', key: 'going_deeper' },
  { name: 'Closing', key: 'closing' },
]

export const DEFAULT_CLOSING_QUESTION =
  'What is one thing you know now that you wish you knew at the beginning?'

// "Core Questions" -> "core_questions", "Warm-Up" -> "warm_up"
export function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeQuestion(raw: unknown): GenQuestion | null {
  if (!raw) return null
  if (typeof raw === 'string') return { question: raw }
  const q = raw as Record<string, unknown>
  const text = (q.question ?? q.text) as string | undefined
  if (!text) return null
  return {
    question: text,
    strength_score: typeof q.strength_score === 'number' ? q.strength_score : undefined,
    context: typeof q.context === 'string' ? q.context : undefined,
    go_deeper: Array.isArray(q.go_deeper) ? (q.go_deeper as string[]) : undefined,
  }
}

// Accepts the new sectioned object, the legacy flat array ([{id,text,section}]),
// or null — and always returns a clean section→questions map plus any stored
// section metadata.
export function normalizeGenerated(generated: unknown): {
  map: GeneratedMap
  storedSections: QSection[] | null
} {
  if (!generated) return { map: {}, storedSections: null }

  // Legacy flat array grouped by each question's section name.
  if (Array.isArray(generated)) {
    const map: GeneratedMap = {}
    for (const item of generated) {
      const q = normalizeQuestion(item)
      if (!q) continue
      const section = ((item as Record<string, unknown>).section as string) ?? 'Core Questions'
      const key = toKey(section)
      ;(map[key] ??= []).push(q)
    }
    return { map, storedSections: null }
  }

  const obj = generated as Record<string, unknown>
  const storedSections = Array.isArray(obj._sections)
    ? (obj._sections as QSection[]).filter((s) => s?.name && s?.key)
    : null

  const map: GeneratedMap = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_sections') continue
    if (Array.isArray(value)) {
      map[key] = value.map(normalizeQuestion).filter((q): q is GenQuestion => !!q)
    }
  }
  return { map, storedSections }
}

// Section order resolved by priority: Podcast DNA → stored-at-generation → default.
export function resolveSections(
  episodeSections: unknown,
  storedSections: QSection[] | null
): QSection[] {
  if (Array.isArray(episodeSections) && episodeSections.length) {
    return (episodeSections as { name: string }[])
      .filter((s) => s?.name)
      .map((s) => ({ name: s.name, key: toKey(s.name) }))
  }
  if (storedSections?.length) return storedSections
  return DEFAULT_SECTIONS
}

// Questions for a section, sorted strongest-first, carrying their original index
// so selection state stays stable regardless of display order.
export function sortedWithIndex(
  questions: GenQuestion[]
): { q: GenQuestion; originalIdx: number }[] {
  return questions
    .map((q, originalIdx) => ({ q, originalIdx }))
    .sort((a, b) => (b.q.strength_score ?? 0) - (a.q.strength_score ?? 0))
}

// Flatten the chosen questions (selected if present, otherwise all) into ordered
// text, with the signature closing appended last. Used by the brief + script.
export function chosenQuestionTexts(
  generated: unknown,
  selected: unknown,
  sections: QSection[],
  closingQuestion: string
): string[] {
  const { map } = normalizeGenerated(generated)
  const sel = (selected ?? null) as Record<string, number[]> | null
  const out: string[] = []
  for (const s of sections) {
    const qs = map[s.key] ?? []
    const idxs = sel?.[s.key]
    const chosen = idxs ? idxs.map((i) => qs[i]).filter(Boolean) : qs
    for (const q of chosen) out.push(q.question)
  }
  if (closingQuestion) out.push(closingQuestion)
  return out
}

// Selected questions (full objects, with context + go_deeper) grouped by section.
// Used by the full-script generator. Sections with no selection are dropped.
export function chosenQuestionsBySection(
  generated: unknown,
  selected: unknown,
  sections: QSection[]
): { name: string; questions: GenQuestion[] }[] {
  const { map } = normalizeGenerated(generated)
  const sel = (selected ?? null) as Record<string, number[]> | null
  return sections
    .map((s) => {
      const qs = map[s.key] ?? []
      const idxs = sel?.[s.key]
      const chosen = idxs ? idxs.map((i) => qs[i]).filter(Boolean) : qs
      return { name: s.name, questions: chosen }
    })
    .filter((s) => s.questions.length > 0)
}

// The five guided prompts shown in Step 3 of the episode wizard. The order here
// is the source of truth: episode.focusAnswers is a positional array matching
// these, so both the UI (Step3Focus) and the AI prompts (lib/ai/prompts) import
// from here to stay in sync. Pairing each answer with its question is what lets
// the AI use context like "I'm interviewing my wife" in questions and the intro.
export const FOCUS_QUESTIONS = [
  { emoji: '❤️', label: 'What do you like about this person?', placeholder: 'What draws you to them…' },
  { emoji: '🤔', label: 'What are you most curious to ask?', placeholder: 'The core thing you want to explore…' },
  { emoji: '😬', label: 'Any concerns or topics to avoid?', placeholder: 'Guardrails for the AI…' },
  { emoji: '🎯', label: 'What vibe do you want?', placeholder: 'Playful, deep, fast-paced…' },
  { emoji: '👥', label: 'What should listeners take away?', placeholder: "The episode's purpose…" },
] as const

export const FOCUS_LABELS = FOCUS_QUESTIONS.map((q) => q.label)

// Renders the host's Step-3 answers as a labelled Q/A block for AI prompts, so
// the model sees *which* question each answer responds to. Returns '' when the
// host answered nothing, so callers can omit the section entirely.
export function formatFocusAnswers(focusAnswers: unknown): string {
  if (!Array.isArray(focusAnswers)) return ''
  return FOCUS_LABELS.map((label, i) => {
    const answer = String(focusAnswers[i] ?? '').trim()
    return answer ? `- ${label}\n  ${answer}` : null
  })
    .filter(Boolean)
    .join('\n')
}

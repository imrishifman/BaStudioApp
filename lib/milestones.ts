// First-time milestones that trigger the review chat bubble. Each fires once
// per account; the key is recorded on User.reviewedMilestones afterwards.
// Add a new milestone by adding an entry here and a completion check in the
// (app) layout — the bubble + API pick it up automatically.

export const MILESTONE_KEYS = [
  'first_show',
  'first_dna',
  'first_episode',
  'first_published',
] as const

export type MilestoneKey = (typeof MILESTONE_KEYS)[number]

export function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === 'string' && (MILESTONE_KEYS as readonly string[]).includes(value)
}

interface MilestoneCopy {
  /** Opening line of the chat bubble. */
  prompt: string
  /** Short title shown in the bubble header. */
  title: string
}

export const MILESTONE_COPY: Record<MilestoneKey, MilestoneCopy> = {
  first_show: {
    title: 'Your first show',
    prompt:
      'I see you just created your first show 🎙️ How was that experience? Tell us what felt smooth — or what got in the way — and help us improve.',
  },
  first_dna: {
    title: 'Your first Show DNA',
    prompt:
      "I see you just set your first Show DNA — that's the difference between a good show and a professional one. How was setting it up? Help us improve.",
  },
  first_episode: {
    title: 'Your first episode',
    prompt:
      'I see you just created your first episode ✨ How was the experience? Tell us what worked and what we could do better.',
  },
  first_published: {
    title: 'First episode published',
    prompt:
      'Congrats on publishing your first episode! 🚀 How was the journey to get here? Your feedback helps us improve.',
  },
}

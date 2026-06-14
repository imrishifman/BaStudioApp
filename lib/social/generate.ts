// Generate Instagram post specs with Claude, on brand and on voice.
// Output is validated/sanitized before it ever reaches the renderer.

import Anthropic from '@anthropic-ai/sdk'
import type { PostSpec, DiagramType, DiagramSpec } from './types'

const DIAGRAMS: DiagramType[] = ['signal', 'stat', 'comparison', 'numbered_rows', 'dots', 'card']

const SYSTEM = `You write Instagram posts for BaStudio (bastudiopodcast.com), an AI podcast PREPARATION studio: a host types a guest's name and the product builds a research dossier, writes non-recycled interview questions, and drafts scripts in the host's own voice.

Positioning: BaStudio stands for readiness. Tagline "Walk in knowing." Pillars: Be ready, Know everything, Bring the best results. Voice: confident, clear, warm, plain. No jargon, no stacked hype.

HARD RULES:
- NEVER use em dashes or en dashes anywhere. Use commas, periods, or rewrite.
- coralPhrase MUST be an exact, contiguous substring of headline (one short phrase, 1-3 words) that is the emotional peak. Emphasis is created by coloring that one phrase, never bold or underline.
- MINIMALISM IS THE RULE: the image shows the headline as the HERO in a huge font, with very little other text. The reader should get the message in one glance.
- headline: SHORT and punchy, ideally 3 to 6 words (hard max ~7) so it renders big and bold. This is the single most important line.
- subline: ONE short secondary line only (or omit if the headline says it all). Never stack multiple lines of supporting text.
- caption: 2 to 4 short paragraphs, ending with a soft CTA like "Start free. Link in bio." No em dashes.
- ctaVerb: a short unique action phrase for the button (e.g. "Try it free", "Get the brief", "See the questions"). Do not reuse the tagline.
- hashtags: 10 to 14, space-separated, podcasting-relevant.
- bg: alternate "ink" and "cloud" across the set for feed variety.
- eyebrow: ALL CAPS hook category, 2 to 5 words.

DIAGRAM (visual of the claim). Pick the type that fits the hook and fill only its fields:
- "signal": the brand mark as hero. Best for brand/tagline posts. No extra fields.
- "stat": one big number. Set bigNumber (e.g. "10 min"), unit (e.g. "PER EPISODE"), totalUnits (e.g. 36), coralUnits (e.g. 6).
- "comparison": two sides. Set leftLabel (the bad/old way) and rightLabel (BaStudio).
- "numbered_rows": a list with one standout. Set rows (4-6) and coralRow (1-based).
- "dots": social proof. Set totalUnits (e.g. 10) and coralUnits (e.g. 9).
- "card": a guest "dossier" with one highlighted fact. Set cardLabel (e.g. "GUEST DOSSIER").

Return ONLY a JSON array of post objects, no prose. Each object:
{"hookType","bg","eyebrow","headline","coralPhrase","subline","caption","hashtags","ctaVerb","diagram":{"type",...fields}}`

type RawSpec = {
  hookType?: string
  bg?: string
  eyebrow?: string
  headline?: string
  coralPhrase?: string
  subline?: string
  caption?: string
  hashtags?: string
  ctaVerb?: string
  diagram?: Partial<DiagramSpec>
}

function stripDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ', ').replace(/[—–]/g, ', ')
}

function sanitize(raw: RawSpec): PostSpec | null {
  if (!raw.headline || !raw.eyebrow || !raw.caption || !raw.diagram?.type) return null
  const headline = stripDashes(String(raw.headline)).trim()
  let coralPhrase = stripDashes(String(raw.coralPhrase ?? '')).trim()
  if (coralPhrase && !headline.includes(coralPhrase)) coralPhrase = '' // never color a phrase that is not in the headline
  const type: DiagramType = DIAGRAMS.includes(raw.diagram.type as DiagramType)
    ? (raw.diagram.type as DiagramType)
    : 'signal'
  return {
    hookType: String(raw.hookType ?? 'general'),
    bg: raw.bg === 'cloud' ? 'cloud' : 'ink',
    eyebrow: stripDashes(String(raw.eyebrow)).toUpperCase().trim(),
    headline,
    coralPhrase,
    subline: stripDashes(String(raw.subline ?? '')).trim(),
    caption: stripDashes(String(raw.caption)).trim(),
    hashtags: String(raw.hashtags ?? '').trim(),
    ctaVerb: stripDashes(String(raw.ctaVerb ?? 'Try it free')).trim(),
    diagram: { ...raw.diagram, type },
  }
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < 0) throw new Error('No JSON array in model output')
  return JSON.parse(text.slice(start, end + 1))
}

export async function generatePostSpecs(
  count: number,
  avoidHooks: string[] = [],
): Promise<PostSpec[]> {
  const anthropic = new Anthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Generate ${count} distinct posts as a JSON array. Vary the hook types and diagrams. Avoid repeating these headlines/hooks already in the library: ${avoidHooks.join(' | ') || 'none yet'}.`,
      },
    ],
  })
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  const arr = extractJsonArray(text)
  return arr.map((r) => sanitize(r as RawSpec)).filter((s): s is PostSpec => s !== null)
}

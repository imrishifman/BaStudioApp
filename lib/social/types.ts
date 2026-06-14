// Shared types for the social auto-poster.

export type Bg = 'ink' | 'cloud'

export type DiagramType =
  | 'signal' // the Broadcast-b mark, large (brand/tagline posts)
  | 'stat' // one big coral number + a unit grid with a coral subset
  | 'comparison' // two panels: muted vs coral
  | 'numbered_rows' // numbered list, one row coral
  | 'dots' // a row of dots, minority muted (social proof)
  | 'card' // a 'dossier' card with muted lines + one coral line

export interface DiagramSpec {
  type: DiagramType
  // Optional, type-specific. Kept loose; renderer reads what it needs.
  bigNumber?: string // stat
  unit?: string // stat
  totalUnits?: number // stat / dots
  coralUnits?: number // stat / dots
  leftLabel?: string // comparison
  rightLabel?: string // comparison
  rows?: number // numbered_rows
  coralRow?: number // numbered_rows (1-based)
  cardLabel?: string // card
}

export interface PostSpec {
  hookType: string
  bg: Bg
  eyebrow: string // ALL CAPS
  headline: string
  coralPhrase: string // exact contiguous substring of headline to color coral
  subline: string
  caption: string // no em dashes
  hashtags: string // space-separated
  ctaVerb: string // unique action verb for the pill
  diagram: DiagramSpec
}

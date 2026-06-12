// Detect and strip AI "research-process narration" — the apologetic, meta
// sentences a model emits when it could not find or access information
// ("Direct access to LinkedIn was not available", "No public information
// exists", "web searches did not yield..."). These must NEVER reach the user as
// a bio or a "fun fact"; an empty result is far better than a disclaimer.
//
// Used server-side after the bio/fun-facts derivation, in both the web research
// route and the shared research-core engine.

const META_PATTERNS: RegExp[] = [
  // "could not be verified", "was not available", "did not yield/return/find"
  /\b(could|can|did|does|do|was|were|is|are)\s*(not|n'?t)\b[^.]{0,40}\b(verif|confirm|determin|find|found|access|avail|locate|obtain|yield|return|browse)/i,
  // "cannot write a bio", "cannot be generated/provided"
  /\bcannot\b[^.]{0,30}\b(write|generate|provide|create|confirm|verify|access|produce|be\s+(generated|written|provided|created))/i,
  /\bunable to\b/i,
  /\bi(?:'m| am)\s+(unable|sorry|not able)/i,
  // "no publicly available information / records / profiles"
  /\bno\b[^.]{0,30}\b(public|publicly available|verifiable|specific|significant)\b[^.]{0,25}\b(information|data|details|records|profiles?|sources?|mention)/i,
  /\bnot (publicly |independently )?(available|accessible|verified|verifiable|found|known|confirmed)\b/i,
  /according to (the )?provided context/i,
  /\bprimary source\b/i,
  /\bweb search(es)?\b/i,
  /\bgeneral search(es)?\b/i,
  // "LinkedIn/Instagram profile ... not / could not / was not"
  /\b(linkedin|instagram|twitter|x)\b[^.]{0,40}\bprofiles?\b[^.]{0,25}\b(not|could|was|were|unavailable|inaccessible)/i,
  /\bbrowsing\b/i,
  /\bsimilar names?\b/i,
  /\black of (accessible|verifiable|public|available)/i,
  /\bpreventing the\b/i,
  /\bcould not be (independently )?verified\b/i,
]

// True when a string is research-process narration rather than a real fact
// about the person. Empty/blank also counts as "meta" (nothing useful).
export function isMetaStatement(text: string): boolean {
  const t = (text || '').trim()
  if (!t) return true
  return META_PATTERNS.some((re) => re.test(t))
}

// Keep only facts that say something real about the person; drop any that
// narrate the research process or admit gaps.
export function cleanFacts(facts: string[]): string[] {
  return (facts || [])
    .map((f) => (f || '').trim())
    .filter((f) => f.length > 0 && !isMetaStatement(f))
}

// A bio that is actually a refusal or gap-narration is worse than nothing.
// Returns '' when the whole bio reads as meta, so the caller can fall back to
// the host's own description.
export function cleanBio(bio: string): string {
  const b = (bio || '').trim()
  if (!b) return ''
  return isMetaStatement(b) ? '' : b
}

// Deterministic, truthful fallback bio built from the host's own words when the
// model produced nothing usable. Uses the host-provided description verbatim so
// we never invent a (possibly wrong) company or claim.
export function fallbackBio(guestName: string, extraContext?: string | null): string {
  const name = (guestName || '').trim()
  const ctx = (extraContext || '').trim()
  if (name && ctx) return `${name}, ${ctx}.`.replace(/\.\.$/, '.')
  if (ctx) return `${ctx}.`.replace(/\.\.$/, '.')
  return name
}

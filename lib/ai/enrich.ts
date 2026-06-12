// Turn the guest links a host pastes (LinkedIn, Instagram, Twitter/X, website)
// into REAL profile data, so the AI knows exactly WHO the guest is instead of
// guessing from a name (the root cause of the "Imri Shifman -> Balata Data"
// misidentification).
//
// Gemini's Google grounding and Anthropic's web_search cannot open LinkedIn,
// Instagram, or X profiles (all block bots), so we use ScrapeCreators, one
// provider + one key for every social platform (api.scrapecreators.com,
// header x-api-key, 1 credit per lookup). The pasted personal website needs no
// provider; we fetch it directly.
//
// Set SCRAPECREATORS_API_KEY to activate the social lookups. Everything is
// fail-soft by design: no key, an unparseable URL, or any provider error just
// skips that source and the pipeline falls back to name + host-context search
// exactly as before. All findings are combined into one knownBio block that the
// research prompt treats as ground truth.

export interface SocialLinks {
  linkedin?: string | null
  instagram?: string | null
  twitter?: string | null
  website?: string | null
}

const SC_BASE = 'https://api.scrapecreators.com'
const FETCH_TIMEOUT_MS = 20_000

// ── URL parsing ─────────────────────────────────────────────────────────────

// Strip tracking params / mobile-share junk, keep the canonical
// https://www.linkedin.com/in/<slug> form the provider expects.
export function canonicalLinkedInUrl(raw?: string | null): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/\/in\/([^/?#]+)/i)
    if (!m) return null
    return `https://www.linkedin.com/in/${decodeURIComponent(m[1])}`
  } catch {
    return null
  }
}

// "https://www.instagram.com/imrishifman?igsh=..." -> "imrishifman"
// Also accepts a bare handle ("imrishifman" or "@imrishifman").
export function instagramHandle(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (!s.includes('/') && !s.includes('.')) return s.replace(/^@/, '') || null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null
    const seg = u.pathname.split('/').filter(Boolean)[0] ?? ''
    const RESERVED = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts'])
    if (!seg || RESERVED.has(seg.toLowerCase())) return null
    return decodeURIComponent(seg).replace(/^@/, '') || null
  } catch {
    return null
  }
}

// "https://x.com/imrishifman" / "https://twitter.com/imrishifman" -> "imrishifman"
export function twitterHandle(raw?: string | null): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (!s.includes('/') && !s.includes('.')) return s.replace(/^@/, '') || null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    if (!/(^|\.)(twitter|x)\.com$/i.test(u.hostname)) return null
    const seg = u.pathname.split('/').filter(Boolean)[0] ?? ''
    const RESERVED = new Set(['i', 'home', 'search', 'explore', 'hashtag', 'intent', 'share'])
    if (!seg || RESERVED.has(seg.toLowerCase())) return null
    return decodeURIComponent(seg).replace(/^@/, '') || null
  } catch {
    return null
  }
}

// ── Per-source fetchers (each returns a labelled text block or null) ────────

async function scFetch(path: string, params: Record<string, string>): Promise<unknown | null> {
  const key = process.env.SCRAPECREATORS_API_KEY
  if (!key) return null
  const qs = new URLSearchParams(params).toString()
  try {
    const res = await fetch(`${SC_BASE}${path}?${qs}`, {
      headers: { 'x-api-key': key },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

interface LiExperience { title?: string; company?: string; subtitle?: string; description?: string; duration?: string; dates?: string }
interface LiEducation { school?: string; degree?: string; subtitle?: string; dates?: string }
interface LiProfile {
  name?: string
  headline?: string
  location?: string
  about?: string
  experience?: LiExperience[]
  experiences?: LiExperience[]
  education?: LiEducation[]
}

// Fallback for LinkedIn profiles that are not publicly visible (ScrapeCreators
// reads the public page and 404s on those). Enrichlayer serves profiles from a
// licensed dataset instead, so it usually has them. Activates only when
// ENRICHLAYER_API_KEY is set.
async function enrichlayerLinkedIn(url: string): Promise<LiProfile | null> {
  const key = process.env.ENRICHLAYER_API_KEY
  if (!key) return null
  const base = process.env.ENRICHLAYER_BASE_URL || 'https://enrichlayer.com/api/v2/profile'
  try {
    const res = await fetch(
      `${base}?profile_url=${encodeURIComponent(url)}&use_cache=if-present&fallback_to_cache=on-error`,
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    )
    if (!res.ok) return null
    const p = (await res.json()) as {
      full_name?: string
      headline?: string
      occupation?: string
      summary?: string
      city?: string
      country_full_name?: string
      experiences?: { title?: string; company?: string; starts_at?: { year?: number }; ends_at?: { year?: number } | null }[]
      education?: { school?: string; degree_name?: string; field_of_study?: string }[]
    }
    if (!p?.full_name && !p?.headline && !p?.summary) return null
    // Normalize to the shared LiProfile shape the formatter understands.
    return {
      name: p.full_name,
      headline: p.headline ?? p.occupation,
      location: [p.city, p.country_full_name].filter(Boolean).join(', ') || undefined,
      about: p.summary,
      experience: p.experiences?.map((e) => ({
        title: e.title,
        company: e.company,
        dates: e.starts_at?.year ? `${e.starts_at.year}-${e.ends_at?.year ?? 'present'}` : undefined,
      })),
      education: p.education?.map((ed) => ({
        school: ed.school,
        degree: [ed.degree_name, ed.field_of_study].filter(Boolean).join(', ') || undefined,
      })),
    }
  } catch {
    return null
  }
}

async function fetchLinkedIn(rawUrl?: string | null): Promise<string | null> {
  const url = canonicalLinkedInUrl(rawUrl)
  if (!url) return null
  const p =
    ((await scFetch('/v1/linkedin/profile', { url })) as LiProfile | null) ??
    (await enrichlayerLinkedIn(url))
  if (!p) return null
  const lines: string[] = []
  if (p.name) lines.push(`Name: ${p.name}`)
  if (p.headline) lines.push(`Headline: ${p.headline}`)
  if (p.location) lines.push(`Location: ${p.location}`)
  if (p.about) lines.push(`About: ${String(p.about).replace(/\s+/g, ' ').slice(0, 600)}`)
  const exp = p.experience ?? p.experiences
  if (Array.isArray(exp) && exp.length) {
    lines.push('Experience:')
    for (const e of exp.slice(0, 6)) {
      const role = [e.title, e.company ?? e.subtitle].filter(Boolean).join(' at ')
      const span = e.dates ?? e.duration ?? ''
      const desc = e.description ? `: ${String(e.description).replace(/\s+/g, ' ').slice(0, 200)}` : ''
      if (role) lines.push(`- ${role}${span ? ` (${span})` : ''}${desc}`)
    }
  }
  if (Array.isArray(p.education) && p.education.length) {
    lines.push('Education:')
    for (const ed of p.education.slice(0, 4)) {
      const line = [ed.degree ?? ed.subtitle, ed.school].filter(Boolean).join(', ')
      if (line) lines.push(`- ${line}${ed.dates ? ` (${ed.dates})` : ''}`)
    }
  }
  if (!lines.length) return null
  return `LinkedIn profile (${url}):\n${lines.join('\n')}`
}

interface IgUser {
  full_name?: string
  biography?: string
  is_verified?: boolean
  category_name?: string
  edge_followed_by?: { count?: number }
  bio_links?: { url?: string }[]
}

async function fetchInstagram(rawUrl?: string | null): Promise<string | null> {
  const handle = instagramHandle(rawUrl)
  if (!handle) return null
  const data = (await scFetch('/v1/instagram/profile', { handle, trim: 'true' })) as
    | { data?: { user?: IgUser }; user?: IgUser }
    | null
  const u = data?.data?.user ?? data?.user
  if (!u) return null
  const lines: string[] = []
  if (u.full_name) lines.push(`Name: ${u.full_name}`)
  if (u.biography) lines.push(`Bio: ${String(u.biography).replace(/\s+/g, ' ').slice(0, 400)}`)
  if (u.category_name) lines.push(`Category: ${u.category_name}`)
  if (typeof u.edge_followed_by?.count === 'number') lines.push(`Followers: ${u.edge_followed_by.count}`)
  if (u.is_verified) lines.push('Verified account')
  const link = u.bio_links?.find((l) => l?.url)?.url
  if (link) lines.push(`Bio link: ${link}`)
  if (!lines.length) return null
  return `Instagram profile (@${handle}):\n${lines.join('\n')}`
}

interface XProfile {
  name?: string
  description?: string
  location?: string
  followers_count?: number
  verified?: boolean
}

async function fetchTwitter(rawUrl?: string | null): Promise<string | null> {
  const handle = twitterHandle(rawUrl)
  if (!handle) return null
  const p = (await scFetch('/v1/twitter/profile', { handle })) as XProfile | null
  if (!p) return null
  const lines: string[] = []
  if (p.name) lines.push(`Name: ${p.name}`)
  if (p.description) lines.push(`Bio: ${String(p.description).replace(/\s+/g, ' ').slice(0, 400)}`)
  if (p.location) lines.push(`Location: ${p.location}`)
  if (typeof p.followers_count === 'number') lines.push(`Followers: ${p.followers_count}`)
  if (!lines.length) return null
  return `Twitter/X profile (@${handle}):\n${lines.join('\n')}`
}

// Personal websites are usually crawlable, so no provider is needed: fetch the
// page and reduce the HTML to readable text (good enough for a bio/about page).
async function fetchWebsite(rawUrl?: string | null): Promise<string | null> {
  if (!rawUrl?.trim()) return null
  let url: URL
  try {
    const s = rawUrl.trim()
    url = new URL(s.startsWith('http') ? s : `https://${s}`)
  } catch {
    return null
  }
  // Social platforms are handled by their dedicated fetchers above.
  if (/(linkedin|instagram|twitter|x|facebook|tiktok|youtube)\.com$/i.test(url.hostname.replace(/^www\./, ''))) return null
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BaStudioBot/1.0; +https://bastudiopodcast.com)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ctype = res.headers.get('content-type') ?? ''
    if (!/text\/html|text\/plain/i.test(ctype)) return null
    const html = (await res.text()).slice(0, 400_000)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&amp;|&quot;|&#\d+;|&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length < 80) return null
    return `Website (${url.hostname}):\n${text.slice(0, 1500)}`
  } catch {
    return null
  }
}

// ── Combined enrichment ─────────────────────────────────────────────────────

// Fetch every pasted link in parallel and combine the findings into one
// knownBio block (ground truth for the research prompt), or null if nothing
// could be read.
export async function enrichFromLinks(links: SocialLinks): Promise<string | null> {
  const [li, ig, tw, web] = await Promise.all([
    fetchLinkedIn(links.linkedin),
    fetchInstagram(links.instagram),
    fetchTwitter(links.twitter),
    fetchWebsite(links.website),
  ])
  const blocks = [li, ig, tw, web].filter((b): b is string => !!b)
  if (!blocks.length) return null
  return `Verified primary-source profile data pulled directly from the guest's own links. This is exactly who the guest is:\n\n${blocks.join('\n\n')}`
}

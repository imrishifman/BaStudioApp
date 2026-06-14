// Font buffers for Satori. We fetch the open-source static woff files from the
// Fontsource CDN (jsDelivr) at runtime and cache them in module scope, so
// nothing needs to be bundled or file-traced for the serverless deploy. Static
// per-weight files render more predictably in Satori than variable fonts.

interface SatoriFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 600 | 700
  style: 'normal'
}

const BASE = 'https://cdn.jsdelivr.net/npm'
const FILES: Array<{ name: string; weight: 400 | 500 | 600 | 700; url: string }> = [
  { name: 'Inter', weight: 400, url: `${BASE}/@fontsource/inter@5.1.0/files/inter-latin-400-normal.woff` },
  { name: 'Inter', weight: 500, url: `${BASE}/@fontsource/inter@5.1.0/files/inter-latin-500-normal.woff` },
  { name: 'Inter', weight: 600, url: `${BASE}/@fontsource/inter@5.1.0/files/inter-latin-600-normal.woff` },
  { name: 'Space Grotesk', weight: 500, url: `${BASE}/@fontsource/space-grotesk@5.1.0/files/space-grotesk-latin-500-normal.woff` },
  { name: 'Space Grotesk', weight: 700, url: `${BASE}/@fontsource/space-grotesk@5.1.0/files/space-grotesk-latin-700-normal.woff` },
]

let cache: SatoriFont[] | null = null

export async function getFonts(): Promise<SatoriFont[]> {
  if (cache) return cache
  cache = await Promise.all(
    FILES.map(async (f) => {
      const r = await fetch(f.url)
      if (!r.ok) throw new Error(`font fetch failed: ${f.name} ${f.weight} (${r.status})`)
      return { name: f.name, data: await r.arrayBuffer(), weight: f.weight, style: 'normal' as const }
    }),
  )
  return cache
}

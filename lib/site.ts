// Canonical, absolute site origin. Used for metadataBase, sitemap, robots, and
// JSON-LD. Override per-environment with NEXT_PUBLIC_SITE_URL (set it in Vercel
// for preview deploys); defaults to the production domain. Always trailing-slash
// free so callers can append paths cleanly.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bastudiopodcast.com').replace(/\/$/, '')

// Absolute URL helper. Pass a leading-slash path ('/lp/podcast-prep').
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

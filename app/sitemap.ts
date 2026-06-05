import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'

// Served at /sitemap.xml. Lists the public, indexable marketing surface only —
// the authenticated app and utility pages are intentionally excluded (and
// disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/pricing'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/lp/podcast-prep'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}

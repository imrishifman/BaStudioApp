import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Served at /robots.txt. Crawlers are welcome on the public marketing surface;
// the authenticated app and API routes are kept out of the index. AI crawlers
// (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) are explicitly allowed so
// the product shows up in AI answers. The sitemap is declared for discovery.
export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    '/api/',
    '/account',
    '/admin',
    '/calendar',
    '/dashboard',
    '/episodes',
    '/guests',
    '/partner',
    '/podcast-dna',
    '/review',
    '/shows',
    '/studio',
    '/team',
    '/auth/',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: '/',
        disallow: privatePaths,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}

import 'server-only'
import { prisma } from '@/lib/prisma'

// DB-backed cache with a short TTL for SEO API responses. Search Console + GA4
// are slow and rate-limited; the dashboard polls a few widgets at once, so we
// serve a recent snapshot when one exists and only hit Google when it's stale.

const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const existing = await prisma.seoSnapshot.findUnique({ where: { key } })
  if (existing && Date.now() - existing.createdAt.getTime() < ttlMs) {
    return existing.data as T
  }
  const fresh = await fetcher()
  await prisma.seoSnapshot.upsert({
    where: { key },
    create: { key, data: fresh as object, createdAt: new Date() },
    update: { data: fresh as object, createdAt: new Date() },
  })
  return fresh
}

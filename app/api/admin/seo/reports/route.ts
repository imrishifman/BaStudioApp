import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { generateSeoReport } from '@/lib/seo/report'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

// GET: recent daily SEO reports (newest first). Admin only.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const reports = await prisma.seoReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, content: true, emailed: true, createdAt: true },
  })
  return NextResponse.json({ reports })
}

// POST: "Run report now" button. Generates + stores a report immediately.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const report = await generateSeoReport()
    return NextResponse.json(report)
  } catch (err) {
    console.error('SEO report run error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate report' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'

export const maxDuration = 20
export const runtime = 'nodejs'
// Always fetch fresh data; polling endpoint should never be cached.
export const dynamic = 'force-dynamic'

// MRR contribution of each price ID. Reads from the same env vars that drive
// Stripe checkout - so live vs test pricing both work automatically.
function priceMonthlyDollars(priceId: string | null): number {
  if (!priceId) return 0
  if (priceId === process.env.STRIPE_PRICE_SOLO_MONTHLY) return 19.99
  if (priceId === process.env.STRIPE_PRICE_SOLO_ANNUAL) return 191.88 / 12
  if (priceId === process.env.STRIPE_PRICE_MASTER_MONTHLY) return 29.99
  if (priceId === process.env.STRIPE_PRICE_MASTER_ANNUAL) return 287.88 / 12
  return 0
}

interface VercelDeployment {
  uid: string
  name?: string
  url?: string
  state?: string  // READY | BUILDING | ERROR | QUEUED | CANCELED
  createdAt?: number
  meta?: { githubCommitSha?: string; githubCommitMessage?: string; githubCommitAuthorName?: string }
  target?: string
}

async function fetchLatestVercelDeploy(): Promise<VercelDeployment | { error: string } | null> {
  const token = process.env.VERCEL_API_TOKEN
  if (!token) return null
  // These are project/team ids we already know from the Vercel MCP earlier.
  const projectId = 'prj_rP425mAha4FTNYuol2tXzwYFsRV4'
  const teamId = 'team_cBLBShWC8mDLMIUel1fNlDd2'
  try {
    const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1&target=production`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // Short timeout: never let a slow Vercel API call block the admin polling cycle.
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { error: `Vercel API ${res.status}` }
    const json = (await res.json()) as { deployments?: VercelDeployment[] }
    return json.deployments?.[0] ?? null
  } catch (err) {
    return { error: (err as Error).message }
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Run all queries in parallel — total endpoint latency = slowest single query,
  // not sum of all queries.
  const [
    activePaidUsers,
    canceledLast30,
    clicksLast24h,
    clicksTotal,
    attributionsTotal,
    conversionsThisMonth,
    unpaidCommissionAgg,
    topInfluencer,
    influencerCount,
    dbPingResult,
    deploy,
  ] = await Promise.all([
    // Subscriptions + revenue (active paid only - cancelAtPeriodEnd is still
    // active until period ends; counted as active until churned via webhook).
    prisma.user.findMany({
      where: { plan: { in: ['solo', 'master'] }, planStatus: 'active' },
      select: { plan: true, stripePriceId: true },
    }),
    prisma.user.count({
      where: {
        OR: [
          { cancelAtPeriodEnd: true, currentPeriodEnd: { gte: now } },
          { planStatus: 'cancelled', currentPeriodEnd: { gte: thirtyDaysAgo } },
        ],
      },
    }),
    // Affiliate live numbers.
    prisma.referralClick.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.referralClick.count(),
    prisma.referralAttribution.count(),
    prisma.influencerConversion.count({ where: { conversionDate: { gte: startOfMonth } } }),
    prisma.influencerConversion.aggregate({
      _sum: { commissionEarned: true },
      where: { commissionPaid: false },
    }),
    prisma.influencerConversion.groupBy({
      by: ['influencerId'],
      _count: { _all: true },
      orderBy: { _count: { influencerId: 'desc' } },
      take: 1,
    }),
    prisma.influencer.count({ where: { status: 'active' } }),
    // System health.
    prisma.$queryRaw`SELECT 1`.then(() => ({ ok: true, error: null as string | null }))
      .catch((e: Error) => ({ ok: false, error: e.message.slice(0, 200) })),
    fetchLatestVercelDeploy(),
  ])

  // Compute MRR from the active subs we just pulled.
  const soloActive = activePaidUsers.filter((u) => u.plan === 'solo').length
  const masterActive = activePaidUsers.filter((u) => u.plan === 'master').length
  const mrr = activePaidUsers.reduce((sum, u) => sum + priceMonthlyDollars(u.stripePriceId), 0)

  // Resolve top influencer name if there is one.
  let topInfluencerName: string | null = null
  let topInfluencerConversions = 0
  if (topInfluencer.length > 0) {
    const top = topInfluencer[0]
    topInfluencerConversions = top._count._all
    const inf = await prisma.influencer.findUnique({
      where: { id: top.influencerId },
      select: { name: true },
    })
    topInfluencerName = inf?.name ?? null
  }

  // Env-var presence (booleans only — never values).
  const present = (v?: string) => typeof v === 'string' && v.trim().length > 0
  const env = {
    anthropic: present(process.env.ANTHROPIC_API_KEY),
    google: present(process.env.GOOGLE_API_KEY),
    stripeSecret: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhook: present(process.env.STRIPE_WEBHOOK_SECRET),
    vercelToken: present(process.env.VERCEL_API_TOKEN),
    resend: present(process.env.RESEND_API_KEY),
    database: present(process.env.DATABASE_URL),
  }

  return NextResponse.json({
    fetchedAt: now.toISOString(),
    subscriptions: {
      soloActive,
      masterActive,
      mrrDollars: +mrr.toFixed(2),
      arrDollars: +(mrr * 12).toFixed(2),
      canceledLast30,
    },
    affiliate: {
      activeInfluencers: influencerCount,
      clicksLast24h,
      clicksTotal,
      attributionsTotal,
      conversionsThisMonth,
      unpaidCommissionDollars: +(unpaidCommissionAgg._sum.commissionEarned ?? 0).toFixed(2),
      topInfluencer: topInfluencerName ? { name: topInfluencerName, conversions: topInfluencerConversions } : null,
    },
    system: {
      db: dbPingResult,
      env,
      deploy,
    },
  })
}
